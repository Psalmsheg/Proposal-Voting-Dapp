# Proposal Voting Dapp

This manages proposals with an array of votes for each proposal. The DApp calculates the vote count and determines if the voting period has ended. This helps to determine if the proposal is still open or closed and prevents multiple votes by the same user.

# Installation instructions

[Follow the Cartesi Rollups installation guide](https://docs.cartesi.io/cartesi-rollups/1.3/development/installation/)

# Compiling Instructions

1. Clone the repository
2. Run `cd ` into the root directory
3. Run `cartesi build`
4. Run `cartesi run`
5. Run `cartesi send` on a new terminal tab and send inputs to create proposals or vote using the necessary steps.
6. Visit the GraphQL endpoint [http://localhost:8080/graphql](http://localhost:8080/graphql) on the browser.

```graphql
query notices {
  notices {
    edges {
      node {
        index
        input {
          index
        }
        payload
      }
    }
  }
}
```

7. Inspect the state of proposals using [http://localhost:8080/inspect](http://localhost:8080/inspect)

## Usage

### Create a Proposal

Send an advance request with:

```json
{
  "action": "create",
  "description": "Your proposal description here"
}
```

### Vote on a Proposal

Send an advance request with:

```json
{
  "action": "vote",
  "proposalId": "1",
  "vote": "yes"
}
```

### List All Proposals

Send an inspect request with:

```
list
```

### Get Proposal Result

Send an inspect request with:

```
result/<proposalId>
```
