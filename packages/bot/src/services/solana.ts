import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  keypairIdentity,
  publicKey,
  percentAmount,
} from '@metaplex-foundation/umi';
import { getSupabaseAdmin, VOTES_PER_NFT } from '@lesezeichnen/shared';
import { generateNFTDescription } from './ai.js';

interface MintParams {
  ownerWallet: string;
  bookTitle: string;
  bookAuthor: string;
  frontImageUrl: string;
  backImageUrl: string;
  rating?: number;
  thoughts?: string;
  bookmarkId: string;
}

interface MintResult {
  mintAddress: string;
  metadataUri: string;
  signature: string;
}

export async function mintBookmarkNFT(params: MintParams): Promise<MintResult> {
  const {
    ownerWallet,
    bookTitle,
    bookAuthor,
    frontImageUrl,
    backImageUrl,
    rating,
    thoughts,
    bookmarkId,
  } = params;

  // Get Solana RPC and authority keypair from environment
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const authoritySecret = process.env.SOLANA_AUTHORITY_SECRET;

  if (!authoritySecret) {
    throw new Error('SOLANA_AUTHORITY_SECRET not configured');
  }

  // Parse authority keypair
  const secretArray = JSON.parse(authoritySecret);
  const authorityKeypair = {
    publicKey: publicKey(secretArray.slice(32)),
    secretKey: new Uint8Array(secretArray),
  };

  // Create Umi instance
  const umi = createUmi(rpcUrl)
    .use(mplTokenMetadata())
    .use(keypairIdentity(authorityKeypair as any));

  // Generate NFT description
  const description = await generateNFTDescription(
    bookTitle,
    bookAuthor,
    thoughts,
    rating
  );

  // Create metadata JSON
  const metadata = {
    name: `Lesezeichnen: ${bookTitle}`,
    symbol: 'LESEN',
    description,
    image: frontImageUrl,
    external_url: 'https://lesezeichnen.vercel.app',
    attributes: [
      { trait_type: 'Book Title', value: bookTitle },
      { trait_type: 'Author', value: bookAuthor },
      { trait_type: 'Rating', value: rating?.toString() || 'Not rated' },
      { trait_type: 'Voting Power', value: VOTES_PER_NFT.toString() },
      { trait_type: 'Type', value: 'Bookmark' },
    ],
    properties: {
      files: [
        { uri: frontImageUrl, type: 'image/jpeg', cdn: true },
        { uri: backImageUrl, type: 'image/jpeg', cdn: true },
      ],
      category: 'image',
      creators: [
        {
          address: authorityKeypair.publicKey.toString(),
          share: 100,
        },
      ],
    },
  };

  // Upload metadata to Supabase storage (as JSON file)
  const supabase = getSupabaseAdmin();
  const metadataPath = `metadata/${bookmarkId}.json`;
  const metadataBuffer = Buffer.from(JSON.stringify(metadata));

  const { error: uploadError } = await supabase.storage
    .from('bookmarks')
    .upload(metadataPath, metadataBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload metadata: ${uploadError.message}`);
  }

  const { data: { publicUrl: metadataUri } } = supabase.storage
    .from('bookmarks')
    .getPublicUrl(metadataPath);

  // Create NFT mint
  const mint = generateSigner(umi);

  const { signature } = await createNft(umi, {
    mint,
    name: `Lesezeichnen: ${bookTitle.substring(0, 20)}`,
    symbol: 'LESEN',
    uri: metadataUri,
    sellerFeeBasisPoints: percentAmount(5), // 5% royalty
    creators: [
      {
        address: umi.identity.publicKey,
        verified: true,
        share: 100,
      },
    ],
    tokenOwner: publicKey(ownerWallet),
  }).sendAndConfirm(umi);

  return {
    mintAddress: mint.publicKey.toString(),
    metadataUri,
    signature: Buffer.from(signature).toString('base64'),
  };
}

export async function getWalletNFTs(walletAddress: string): Promise<string[]> {
  // In production, you would query the blockchain or use a indexer like Helius
  // For now, we use our database cache
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('nft_ownership')
    .select('mint_address')
    .eq('owner_wallet', walletAddress);

  return data?.map(n => n.mint_address) || [];
}

export async function syncNFTOwnership(mintAddress: string): Promise<void> {
  // In production, query the blockchain for current owner
  // This would be called by a webhook from Helius or similar
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenLargestAccounts',
        params: [mintAddress],
      }),
    });

    const data = await response.json();
    const accounts = data.result?.value || [];

    if (accounts.length > 0 && accounts[0].amount === '1') {
      // Get account info to find owner
      const accountResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [accounts[0].address, { encoding: 'jsonParsed' }],
        }),
      });

      const accountData = await accountResponse.json();
      const owner = accountData.result?.value?.data?.parsed?.info?.owner;

      if (owner) {
        const supabase = getSupabaseAdmin();
        await supabase
          .from('nft_ownership')
          .update({
            owner_wallet: owner,
            last_synced_at: new Date().toISOString(),
          })
          .eq('mint_address', mintAddress);
      }
    }

  } catch (error) {
    console.error('NFT ownership sync failed:', error);
  }
}
