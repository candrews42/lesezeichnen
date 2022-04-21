use crate::*;

#[near_bindgen]
impl Contract {
    //create a proposal
    //fn create_proposal(&mut self, token_id: TokenId, book_proposal: String, msg: Option<String>);

    //vote on the next book to be read
    #[payable]
    pub fn cast_votes(&mut self, token_id: TokenId, book_name: String, num_votes: u64) {
        assert_at_least_one_yocto();

        //get the token object from the token Id
        let mut token = self.tokens_by_id.get(&token_id).expect("No token");

        //make sure person calling function is the owner
        assert_eq!(
            &env::predecessor_account_id(),
            &token.owner_id,
            "Predecessor must be the token owner."
        );

        if token.votes_available >= num_votes {
            //check if the book has been voted on already
            let is_new_vote_cast = token
                .votes_cast
                //insert returns none if the key was not present
                .insert(book_name.clone(), num_votes)
                //if the key was not present, .is_none() will return true so it is a new vote
                .is_none();

            //if it was a new vote to the proposal, calculate how much storage is being used
            let storage_used = if is_new_vote_cast {
                bytes_for_vote_cast(book_name.clone())
            } else {
                0
            };

            //decrement the number of votes available
            token.votes_cast.insert(book_name.clone(), num_votes);
            token.votes_available -= num_votes;

            //insert the token back into the tokens_by_id collection
            self.tokens_by_id.insert(&token_id, &token);

            //refund any excess storage atteched by the user, or panic
            refund_deposit(storage_used); 
        } else {refund_deposit(0)}        
    }

    #[payable]
    //revoke the votes from a specific book
    pub fn vote_revoke(&mut self, token_id: TokenId, book_name: String) {
        assert_at_least_one_yocto();
        //get the token object
        let mut token = self.tokens_by_id.get(&token_id).expect("No token");

        //get the caller of the function and assert that they are the owner of the token
        let predecessor_account_id = env::predecessor_account_id();
        assert_eq!(&predecessor_account_id.clone(), &token.owner_id);

        if token.votes_cast.get(&book_name).is_some() {
            token.votes_available += token.votes_cast.get(&book_name).unwrap_or(&0);
            //if the account ID was in the token's approval, we remove it and the if statement logic executes
            if token.votes_cast.remove(&book_name).is_some() {
                //refund the funds released by removing the approved_account_id to the caller of the function
                let storage_released: u64 = bytes_for_vote_cast(book_name);
                Promise::new(predecessor_account_id).transfer(Balance::from(storage_released) * env::storage_byte_cost());
                //insert the token back into the tokens_by_id collection with the book removed from the voted books list
                self.tokens_by_id.insert(&token_id, &token);
            }
        }
    }

    #[payable]
    //revoke the votes from all books
    pub fn vote_revoke_all(&mut self, token_id: TokenId) {
        assert_at_least_one_yocto();
        //get the token object using the passed in token_id
        let mut token = self.tokens_by_id.get(&token_id).expect("No token");

        //get the caller of the function and assert that they are the owner of the token
        let predecessor_account_id = env::predecessor_account_id();
        assert_eq!(&predecessor_account_id, &token.owner_id);

        let mut storage_released: u64 = 0;
        for key in token.votes_cast.keys() {
            storage_released += bytes_for_vote_cast(key.to_string())
        }   
        Promise::new(predecessor_account_id).transfer(Balance::from(storage_released) * env::storage_byte_cost());
        //clear the votes
        token.votes_cast.clear();
        //return available votes
        token.votes_available = token.voting_power;
        //insert the token back into the tokens_by_id collection with the approved account IDs cleared
        self.tokens_by_id.insert(&token_id, &token);
        
    }
}
