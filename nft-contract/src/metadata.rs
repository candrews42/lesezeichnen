use crate::*;
pub type TokenId = String;
//defines the payout type we'll be returning as a part of the royalty standards.
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Payout {
    pub payout: HashMap<AccountId, U128>,
} 

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct NFTContractMetadata {
    pub spec: String, //version like "nft-1.0.0"
    pub name: String, 
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>, //centralized gateway for reliable access to decent stroage assets by URLs
    pub reference: Option<String>, //url to JSON file with more info
    pub reference_hash: Option<Base64VecU8>, //Base64-encoded sha256 hash of JSON from reference
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>, //e.g. "bookmark 1"
    pub description: Option<String>, //free-form description
    pub rating: Option<u8>, //rating on scale of 1 to 5
    pub media: Option<String>, //URL to associated media
    pub media_hash: Option<Base64VecU8>, //hash of media field
    pub copies: Option<u64>, //number of copies when minted
    pub issued_at: Option<u64>, //when token was issued or minted. Unix epoch in milliseconds
    pub expires_at: Option<u64>, //when token expires
    pub starts_at: Option<u64>, //when token starts being valid
    pub updated_at: Option<u64>, //when token last updated
    pub extra: Option<String>, //anything extra the NFT wants to store on-chain
    pub reference: Option<String>, //url to an off-chain json file with more info
    pub reference_hash: Option<Base64VecU8>, //Base64-encoded sha256 has of JSON from reference field
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Token {
    //owner of the token
    pub owner_id: AccountId,
    //list of approved account IDs that have access to transfer the token. This maps an account ID to an approval ID
    pub approved_account_ids: HashMap<AccountId, u64>,
    //the next approval ID to give out
    pub next_approval_id: u64,
    pub royalty: HashMap<AccountId, u32>,
}

//The Json token is what will be returned from view calls. 
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JsonToken {
    //token ID
    pub token_id: TokenId,
    //owner of the token
    pub owner_id: AccountId,
    //token metadata
    pub metadata: TokenMetadata,
    //list of approved account IDs that have access to transfer token
    pub approved_account_ids: HashMap<AccountId, u64>,
    pub royalty: HashMap<AccountId, u32>
}

pub trait NonFungibleTokenMetadata {
    //view call for returning the contract metadata
    fn nft_metadata(&self) -> NFTContractMetadata;
}

#[near_bindgen]
impl NonFungibleTokenMetadata for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }
}