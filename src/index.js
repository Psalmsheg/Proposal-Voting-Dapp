const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

function hex2str(hex) {
  return ethers.toUtf8String(hex);
}

function str2hex(payload) {
  return ethers.hexlify(ethers.toUtf8Bytes(payload));
}

let proposals = {};
let votes = {};
const VOTING_PERIOD = 5 * 60 * 1000; 

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));

  const metadata = data["metadata"];
  const sender = metadata["msg_sender"];
  const payload = hex2str(data["payload"]);

  try {
    const { action, proposalId, description, vote } = JSON.parse(payload);

    let responseMessage = "";

    switch (action) {
      case "create":
        if (!description) {
          throw new Error("Proposal description is required.");
        }
        const newProposalId = Object.keys(proposals).length + 1;
        proposals[newProposalId] = {
          id: newProposalId,
          description,
          creator: sender,
          yesVotes: 0,
          noVotes: 0,
          createdAt: Date.now(),
          voters: {}
        };
        responseMessage = `Proposal created with ID: ${newProposalId}`;
        break;

      case "vote":
        if (!proposalId || !vote) {
          throw new Error("ProposalId and vote are required.");
        }
        if (!proposals[proposalId]) {
          throw new Error("Proposal does not exist.");
        }
        if (Date.now() > proposals[proposalId].createdAt + VOTING_PERIOD) {
          throw new Error("Voting period has ended for this proposal.");
        }
        if (proposals[proposalId].voters[sender]) {
          throw new Error("You have already voted on this proposal.");
        }
        if (vote !== "yes" && vote !== "no") {
          throw new Error("Invalid vote. Use 'yes' or 'no'.");
        }
        proposals[proposalId].voters[sender] = true;
        if (vote === "yes") {
          proposals[proposalId].yesVotes++;
        } else {
          proposals[proposalId].noVotes++;
        }
        responseMessage = `Vote recorded for proposal ${proposalId}`;
        break;

      default:
        throw new Error("Invalid action. Use 'create' or 'vote'.");
    }

    const notice_req = await fetch(rollup_server + "/notice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: str2hex(responseMessage) }),
    });

    return "accept";
  } catch (error) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: str2hex(error.message) }),
    });

    return "reject";
  }
}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));

  const payload = data["payload"];
  const route = hex2str(payload);

  let responseObject;
  if (route === "list") {
    responseObject = JSON.stringify(Object.values(proposals).map(p => ({
      id: p.id,
      description: p.description,
      yesVotes: p.yesVotes,
      noVotes: p.noVotes,
      status: Date.now() > p.createdAt + VOTING_PERIOD ? "Closed" : "Open"
    })));
  } else if (route.startsWith("result/")) {
    const proposalId = route.split("/")[1];
    if (!proposals[proposalId]) {
      responseObject = JSON.stringify({ error: "Proposal does not exist." });
    } else {
      const p = proposals[proposalId];
      const status = Date.now() > p.createdAt + VOTING_PERIOD ? "Closed" : "Open";
      responseObject = JSON.stringify({
        id: p.id,
        description: p.description,
        yesVotes: p.yesVotes,
        noVotes: p.noVotes,
        status,
        result: status === "Closed" ? (p.yesVotes > p.noVotes ? "Passed" : "Failed") : "Ongoing"
      });
    }
  } else {
    responseObject = JSON.stringify({ error: "Route not implemented. Use 'list' or 'result/<proposalId>'." });
  }

  const report_req = await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: str2hex(responseObject) }),
  });

  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();