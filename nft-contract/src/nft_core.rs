use crate::*;
use near_sdk::{ext_contract, log, Gas, PromiseResult};

const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas(10_000_000_000_000);
const GAS_FOR_NFT_TRANSFER_CALL: Gas = Gas(25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER.0);
const NO_DEPOSIT: Balance = 0;

pub trait NonFungibleTokenCore {
    //transfers an NFT to a receiver ID
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    );

    //transfers an NFT to a receiver and calls a function on the receiver ID's contract
    /// Returns `true` if the token was transferred from the sender's account.
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> ;

    //get information about the NFT token passed in
    fn nft_token(&self, token_id: TokenId) -> Option<JsonToken>;
}

#[ext_contract(ext_non_fungible_token_receiver)]
trait NonFungibleTokenReceiver {
    //Method stored on the receiver contract that is called via cross contract call when nft_transfer_call is called
    /// Returns `true` if the token should be returned back to the sender.
    fn nft_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_id: AccountId,
        token_id: TokenId,
        msg: String,
    ) -> Promise;
}

#[ext_contract(ext_self)]
trait NonFungibleTokenResolver {
    /*
        resolves the promise of the cross contract call to the receiver contract
        this is stored on THIS contract and is meant to analyze what happened in the cross contract call when nft_on_transfer was called
        as part of the nft_transfer_call method
    */
    fn nft_resolve_transfer(
        &mut self,
        owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: HashMap<AccountId, u64>,
    ) -> bool ;
     
}

/*
    resolves the promise of the cross contract call to the receiver contract
    this is stored on THIS contract and is meant to analyze what happened in the cross contract call when nft_on_transfer was called
    as part of the nft_transfer_call method
*/ 
trait NonFungibleTokenResolver {
    fn nft_resolve_transfer(
        &mut self,
        owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: HashMap<AccountId, u64>
    ) -> bool;
}

#[near_bindgen]
impl NonFungibleTokenCore for Contract {

    //implementation of the nft_transfer method. This transfers the NFT from the current owner to the receiver. 
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        //assert that the user attached 1 yoctoNEAR, for security
        assert_one_yocto();
        //get the sender to transfer the token from sender to the receiver
        let sender_id = env::predecessor_account_id();

        //call internal transfer method
        let previous_token = self.internal_transfer(
            &sender_id,
            &receiver_id,
            &token_id,
            approval_id,
            memo,
        );

        //refund the owner for releasing the storage used up by the approved account IDs
        refund_approved_account_ids(
            previous_token.owner_id.clone(),
            &previous_token.approved_account_ids,
        );
    }

    //implementation of the transfer call method. This will transfer the NFT and call a method on the reciver_id contract
    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        //assert 1 yocto attached for security
        assert_one_yocto();
        //get sender ID
        let sender_id = env::predecessor_account_id();

        //transfer token and get previous token object
        let previous_token = self.internal_transfer(
            &sender_id,
            &receiver_id,
            &token_id,
            approval_id,
            memo,
        );

        //initiating receiver's call and callback
        ext_non_fungible_token_receiver::nft_on_transfer(
            sender_id,
            previous_token.owner_id.clone(),
            token_id.clone(),
            msg,
            receiver_id.clone(), //contract account to make the call to
            NO_DEPOSIT, //attached deposit
            env::prepaid_gas() - GAS_FOR_NFT_TRANSFER_CALL,
        )
        //then resolve the promise and call nft_resolve_transfer on our own contract
        .then(ext_self::nft_resolve_transfer(
            previous_token.owner_id,
            receiver_id,
            token_id,
            previous_token.approved_account_ids,
            env::current_account_id(),
            NO_DEPOSIT,
            GAS_FOR_RESOLVE_TRANSFER,
        )).into()
    }

    //get the information for a specific token ID
    fn nft_token(&self, token_id: TokenId) -> Option<JsonToken> {
        //if there is some token ID in the tokens_by_id collection
        if let Some(token) = self.tokens_by_id.get(&token_id) {
            //we'll get some metadata for that token
            let metadata = self.token_metadata_by_id.get(&token_id).unwrap();
            //we return the JsonToken (wrapped by Some since we return an option)
            Some(JsonToken {
                token_id,
                owner_id: token.owner_id,
                metadata,
                approved_account_ids: token.approved_account_ids,
            })
        } else {
            None
        }
    }
}

#[near_bindgen]
impl NonFungibleTokenResolver for Contract {
    //resolves the cross contract call when calling nft_on_transfer in the nft_transfer_call method
    //returns true if the token was successfully transferred to the receiver_id
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: HashMap<AccountId, u64>,
    ) -> bool {
           //whether receiver wants to return token back to sender, based on 'nft_on_transfer' call result
           if let PromiseResult::Successful(value) = env::promise_result(0) {
            // return whether or not we should return the token
            if let Ok(return_token) = near_sdk::serde_json::from_slice::<bool>(&value) {
                //if we don't need to return the token, return true meaning everything went fine
                if !return_token {
                    refund_approved_account_ids(owner_id, &approved_account_ids);
                    return true;
                }
            }
        }

        //get the token object if there is some token object
        let mut token = if let Some(token) = self.tokens_by_id.get(&token_id) {
            if token.owner_id != receiver_id {
                //the token is not owned by the reciever anymore. Can't return it.
                refund_approved_account_ids(owner_id, &approved_account_ids);
                return true;
            }
            token
        } else {
        //if there isn't a token object, it was burned and so we return true
            return true;
        };

        //if at the end, we haven't returned true, that means we should return the token to its original owner
        log!("Return {} from @{} to @{}", token_id, receiver_id, owner_id);
        
        //remove token from receiver
        self.internal_remove_token_from_owner(&receiver_id, &token_id);
        //add token to original owner
        self.internal_add_token_to_owner(&owner_id, &token_id);

        //change token struct's owner to be original owner
        token.owner_id = owner_id;


        //refund the receiver any approved account IDs that they may have set on the token
        refund_approved_account_ids(receiver_id, &token.approved_account_ids);
        //reset the approved account IDs to what they were before the transfer
        token.approved_account_ids = approved_account_ids;

        //insert token back into collection
        self.tokens_by_id.insert(&token_id, &token);

        false
    }
}