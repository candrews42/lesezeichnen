use crate::*;
use near_sdk::{ext_contract, Gas};

const GAS_FOR_VOTING: Gas = Gas(10_000_000_000_000);
const NO_DEPOSIT: Balance = 0;

pub trait VotingCore {
    //create a proposal
    //fn create_proposal(&mut self, token_id: TokenId, book_proposal: String, msg: Option<String>);

    //vote on the next book to be read
    pub fn cast_votes(&mut self, token_id: TokenId, book_proposal: String, num_votes: u128, msg: Option<String>);

    /*
    //check if the passed in account has enough voting power to cast vote
	fn check_enough_votes(&self, token_id: TokenId, num_votes: votes_available) -> bool;

    //revoke the votes from a specific book
    fn vote_revoke(&mut self, token_id: TokenId, book_proposal);

    //revoke the votes from all books
    fn vote_revoke_all(&mut self, token_id: TokenId); */
}

#[near_bindgen]
impl VotingCore for Contract {
    /* //create proposal
    #[payable]
    fn create_proposal(&mut self, token_id: TokenId, book_proposal: String, msg: Option<String>);
        let mut proposals = Default::default();
        proposals.insert(&proposal_1.name, &proposal_1);

        assert_at_least_one_yocto();

        //get the token object from the token Id
        let mut token = self.tokens_by_id.get(&token_id).expect("No token");

        //make sure person calling function is the owner
        assert_eq!(
            &env::predecessor_account_id(),
            &token.owner_id,
            "Predecessor must be the token owner."
        );

        //get the number of votes available
        let votes_available: u64 = token.votes_available;

        //check if the account has been approved already for this token
        let is_new_approval = token
            .votes_cast
            //insert returns none if the key was not present
            .insert(BookPorposal.clone(), approval_id)
            //if the key was not present, .is_none() will return true so it is a new approval
            .is_none();

        //if it was a new approval, calculate how much storage is being used
        let storage_used = if is_new_approval {
            bytes_for_approved_account_id(&account_id)
        } else {
            0
        };

        //decrement the number of votes available
        token.next_approval_id += 1;
        //insert the token back into the tokens_by_id collection
        self.tokens_by_id.insert(&token_id, &token);

        //refund any excess storage atteched by the user, or panic
        refund_deposit(storage_used);
 */
    //vote on the next book to be read
    #[payable]
    pub fn cast_votes(&mut self, token_id: TokenId, book_proposal: BookProposal, num_votes: u128, msg: Option<String>) {
        assert_at_least_one_yocto();

        //get the token object from the token Id
        let mut token = self.tokens_by_id.get(&token_id).expect("No token");

        //make sure person calling function is the owner
        assert_eq!(
            &env::predecessor_account_id(),
            &token.owner_id,
            "Predecessor must be the token owner."
        );

        //get the number of votes available
        let votes_available: u64 = token.votes_available;

        //check if the book has been voted on already
        let is_new_vote_cast = token
            .votes_cast
            //insert returns none if the key was not present
            .insert(book_proposal.clone(), num_votes)
            //if the key was not present, .is_none() will return true so it is a new vote
            .is_none();

        //if it was a new vote to the proposal, calculate how much storage is being used
        let storage_used = if is_new_vote_cast {
            bytes_for_vote_cast(&book_proposal)
        } else {
            0
        };

        //decrement the number of votes available
        token.votes_cast.insert(&book_proposal.book_name, num_votes)
        token.votes_available -= num_votes;

        //insert the token back into the tokens_by_id collection
        self.tokens_by_id.insert(&token_id, &token);

        //refund any excess storage atteched by the user, or panic
        refund_deposit(storage_used);

        /* //if some message was passed into the function, initiate a cross contract call on the account we're giving access
        if let Some(msg) = msg {
            ext_non_fungible_approval_receiver::nft_on_vote(
                token_id,
                token.owner_id,
                book_proposal,
                msg,
                account_id,
                NO_DEPOSIT,
                env::prepaid_gas() - GAS_FOR_NFT_APPROVE,
            )
            .as_return();
        } */
    }

    /* //check if the passed in account has enough voting power to cast vote
	fn check_enough_votes(
        &self,
        token_id: TokenId,
        num_votes: votes_available,
    ) -> bool;
        //get the token object from the token_id
        let token = self.tokens_by_id.get(&token_id).expect("No token");

        //get the approval for the passed in account ID
        let approval = token.approved_account_ids.get(&approved_account_id);

        //if the was some approval ID found for the account ID
        if let Some(approval) = approval {
            //if a specific approval_id was passed into the function
            if let Some(approval_id) = approval_id {
                //return if the approval ID passed in matches the actual appoval ID for the account
                approval_id == *approval
            } else {
                true
            }
        } else {
            false
        }
    }

    //revoke the votes from a specific book
    #[payable]
    fn vote_revoke(&mut self, token_id: TokenId, book_proposal);
        assert_one_yocto();
        //get the token object using the passed in token_id
        let mut token = self.tokens_by_id.get(&token_id).expect("No toekn");

        //get the caller of the function and assert that they are the owner of the token
        let predecessor_account_id = env::predecessor_account_id();
        assert_eq!(&predecessor_account_id, &token.owner_id);

        //if the account ID was in the token's approval, we remove it and the if statement logic executes
        if token
            .approved_account_ids
            .remove(&account_id)
            .is_some()

        {
            //refund the funds released by removing the approved_account_id to the caller of the function
            refund_approved_account_ids_iter(predecessor_account_id, [account_id].iter());
            //insert the token back into the tokens_by_id collection with the account_id removed from the approval list
            self.tokens_by_id.insert(&token_id, &token);
        }
    }

    //revoke the votes from all books
    #[payable]
    fn vote_revoke_all(&mut self, token_id: TokenId);
        assert_one_yocto();
        //get the token object using the passed in token_id
        let mut token = self.tokens_by_id.get(&token_id).expect("No token");

        //get the caller of the function and assert that they are the owner of the token
        let predecessor_account_id = env::predecessor_account_id();
        assert_eq!(&predecessor_account_id, &token.owner_id);

        //if the account ID was in the token's approval, we remove it and the if statement logic executes
        if token.approved_account_ids.is_empty() {
            //refund the approved account_ids to the caller of the function
            refund_approved_account_ids(predecessor_account_id, &token.approved_account_ids);
            //clear the approved account IDs
            token.approved_account_ids.clear();
            //insert the token back into the tokens_by_id collection with the approved account IDs cleared
            self.tokens_by_id.insert(&token_id, &token);
        }
    } */
}





/* 
impl Default for Proposals {
    fn default() -> Self {

        let proposal_1 = Proposal{
            book_name: "Hitchhiker's Guide to the Galaxy".to_string(),
            author: "Douglas Adams",
        };

        let proposal_2 = Proposal{
            book_name: "Foundation".to_string(),
            author: "Isaac Asimov".to_string(),
        };

        let mut initial_proposals = LookupMap::new(0);
        initial_proposals.insert(&proposal_1.name, &proposal_1);
        initial_proposals.insert(&proposal_2.name, &proposal_2);

        Self {
            proposals: initial_proposals,
        }
    }
} */
