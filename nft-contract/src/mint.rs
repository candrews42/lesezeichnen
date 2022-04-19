use crate::*;

#[near_bindgen]
impl Contract {
    #[payable]
    pub fn nft_mint(
        &mut self,
        token_id: TokenId,
        metadata: TokenMetadata,
        receiver_id: AccountId,
        perpetual_royalties: Option<HashMap<AccountId, u32>>,
    ) {
        //measure the initial storage being used on the contract
        let initial_storage_usage = env::storage_usage();

        //create a royalty map to store in the token
        let mut royalty = HashMap::new();

        //if there are royalties
        if let Some(perpetual_royalties) = perpetual_royalties {
            //make sure that the length of the perpetual royalties is below 7 since we won't have enough
            assert!(perpetual_royalties.len() < 7, "Cannot add more than 6 perpetual royalty amounts")

            //iterate through the perpetual royalties and insert the account and amount in the royalty
            for (account, amount) in perpetual_royalties {
                royalty.insert(account, amount);
            }
        }

        //specify the token struct that contains the owner ID
        let token = Token {
            //set the owner ID equal to the receiever ID passed into the function
            owner_id: receiver_id, 
            //approved account IDs to the default value
            approved_account_ids: Default::default(),
            //next approval ID is set to 0
            next_approval_id: 0,
            //the map of perpetual royalties for the token
            royalty,
        };

        //insert the token ID and token struct and make sure that the token doesn't exist
        assert!(
            self.tokens_by_id.insert(&token_id, &token).is_none(),
            "Token already exists"
        );

        //insert the token ID and metadata
        self.token_metadata_by_id.insert(&token_id, &metadata);

        //call the internal method for adding the token to the owner
        self.internal_add_token_to_owner(&token.owner_id, &token_id);
        
        //calculate the required storage which was used
        let required_storage_in_bytes = env::storage_usage() - initial_storage_usage;

        //refund any excess storage if the user attached too much. Panic if they didn't attach enough to cover reuired
        refund_deposit(required_storage_in_bytes);
    }
}