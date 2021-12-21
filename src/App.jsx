import { useEffect, useMemo, useState } from "react";
import { ThirdwebSDK } from "@3rdweb/sdk";
import { useWeb3 } from "@3rdweb/hooks";
import { ethers } from "ethers";

const sdk = new ThirdwebSDK("rinkeby");
const bundleDropModule = sdk.getBundleDropModule(
  "0x20fF947B1aF78dBb2f63CC8882eA17B0c82D4B63"
);
const tokenModule = sdk.getTokenModule(
  "0xcf869F22dFe688Fe1B78252EeD4ccfbB7fca9DdA"
);
const voteModule = sdk.getVoteModule(
  "0x732009b7C8Af15844ACb48827e8FD0cEE0495F56"
);

const App = () => {
  // use the connectWallet hook thirdweb gives us
  const { connectWallet, address, error, provider } = useWeb3();
  console.log("👋 Address:", address);

  //required to sign transaction, without can only read, not write
  const signer = provider ? provider.getSigner() : undefined;
  // state variable for if user has NFT
  const [hasClaimedNFT, setHasClaimedNFT] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [memberTokenAmounts, setMemberTokenAmounts] = useState({});
  const [memberAddresses, setMemberAddresses] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!hasClaimedNFT) {
      return;
    }
    voteModule
      .getAll()
      .then((proposals) => {
        setProposals(proposals);
        console.log("🌈 Proposals:", proposals);
      })
      .catch((err) => {
        console.error("failed to get proposals", err);
      });
  }, [hasClaimedNFT]);

  useEffect(() => {
    if (!hasClaimedNFT) {
      return;
    }
    if (!proposals.length) {
      return;
    }

    voteModule
      .hasVoted(proposals[0].proposalId, address)
      .then((hasVoted) => {
        setHasVoted(hasVoted);
        console.log("🥵 User has already voted");
      })
      .catch((err) => {
        console.error("failed to check if wallet has voted", err);
      });
  }, [hasClaimedNFT, proposals, address]);

  const shortenAddress = (str) => {
    return str.substring(0, 6) + "..." + str.substring(str.length - 4);
  };
  useEffect(() => {
    if (!hasClaimedNFT) {
      return;
    }
    bundleDropModule
      .getAllClaimerAddresses("0")
      .then((addresess) => {
        console.log("🚀 Member addresses", addresess);
        setMemberAddresses(addresess);
      })
      .catch((err) => {
        console.error("failed to get member list", err);
      });
  }, [hasClaimedNFT]);

  useEffect(() => {
    if (!hasClaimedNFT) {
      return;
    }

    // Grab all the balances.
    tokenModule
      .getAllHolderBalances()
      .then((amounts) => {
        console.log("👜 Amounts", amounts);
        setMemberTokenAmounts(amounts);
      })
      .catch((err) => {
        console.error("failed to get token amounts", err);
      });
  }, [hasClaimedNFT]);

  const memberList = useMemo(() => {
    return memberAddresses.map((address) => {
      return {
        address,
        tokenAmount: ethers.utils.formatUnits(
          memberTokenAmounts[address] || 0,
          18
        ),
      };
    });
  }, [memberAddresses, memberTokenAmounts]);

  useEffect(() => {
    sdk.setProviderOrSigner(signer);
  }, [signer]);

  useEffect(() => {
    if (!address) {
      return;
    }
    return bundleDropModule
      .balanceOf(address, "0")
      .then((balance) => {
        if (balance.gt(0)) {
          setHasClaimedNFT(true);
          console.log("🌟 this user has a Wellness Token!");
        } else {
          setHasClaimedNFT(false);
          console.log("😭 this user doesn't have a Wellness Token.");
        }
      })
      .catch((error) => {
        setHasClaimedNFT(false);
        console.error("failed to get NFT balance", error);
      });
  }, [address]);

  if (error && error.name === "UnsupportedChainIdError") {
    return (
      <div className="unsupported-network">
        <h2>Please connect to Rinkeby</h2>
        <p>
          This dapp only works on the Rinkeby network, please switch networks in
          your connected wallet.
        </p>
        <div className="footer-container" />
      </div>
    );
  }

  // this is where the user hasn't connected wallet
  // to your web app, call connectWallet
  if (!address) {
    return (
      <div className="landing">
      <img
        <h1>Welcome to BeGoodDAO</h1>
        <button onClick={() => connectWallet("injected")} className="btn-gradient btn-hero">
          connect your wallet
        </button>
        <div className="footer-container" />
      </div>
    );
  }

  if (hasClaimedNFT) {
    return (
      <div className="member-page">
        <h1>&#9829;Be Good DAO Member Page</h1>
        <p>Thank you for being a member of our community</p>
        <div>
          <div>
            <h2>Member List</h2>
            <table className="card">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Token Amount</th>
                </tr>
              </thead>
              <tbody>
                {memberList.map((member) => {
                  return (
                    <tr key={member.address}>
                      <td>{shortenAddress(member.address)}</td>
                      <td>{member.tokenAmount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div>
            <h2>Active Proposals</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                setIsVoting(true);

                const votes = proposals.map((proposal) => {
                  let voteResult = {
                    proposalId: proposal.proposalId,
                    vote: 2,
                  };
                  proposal.votes.forEach((vote) => {
                    const elem = document.getElementById(
                      proposal.proposalId + "-" + vote.type
                    );

                    if (elem.checked) {
                      voteResult.vote = vote.type;
                      return;
                    }
                  });
                  return voteResult;
                });

                try {
                  const delegation = await tokenModule.getDelegationOf(address);
                  if (delegation === ethers.constants.AddressZero) {
                    await tokenModule.delegateTo(address);
                  }
                  try {
                    await Promise.all(
                      votes.map(async (vote) => {
                        const proposal = await voteModule.get(vote.proposalId);
                        if (proposal.state === 1) {
                          return voteModule.vote(vote.proposalId, vote.vote);
                        }
                        return;
                      })
                    );
                    try {
                      await Promise.all(
                        votes.map(async (vote) => {
                          const proposal = await voteModule.get(
                            vote.proposalId
                          );

                          if (proposal.state === 4) {
                            return voteModule.execute(vote.proposalId);
                          }
                        })
                      );
                      setHasVoted(true);
                      console.log("successfully voted");
                    } catch (err) {
                      console.error("failed to execute votes", err);
                    }
                  } catch (err) {
                    console.error("failed to vote", err);
                  }
                } catch (err) {
                  console.error("failed to delegate tokens");
                } finally {
                  setIsVoting(false);
                }
              }}
            >
              {proposals.map((proposal, index) => (
                <div key={proposal.proposalId} className="card">
                  <h5>{proposal.description}</h5>
                  <div>
                    {proposal.votes.map((vote) => (
                      <div key={vote.type}>
                        <input
                          type="radio"
                          id={proposal.proposalId + "-" + vote.type}
                          name={proposal.proposalId}
                          value={vote.type}
                          defaultChecked={vote.type === 2}
                        />
                        <label htmlFor={proposal.proposalId + "-" + vote.type}>
                          {vote.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button disabled={isVoting || hasVoted} type="submit">
                {isVoting
                  ? "Voting..."
                  : hasVoted
                  ? "You Already Voted"
                  : "Submit Your Votes"}
              </button>
              <small>
                This will trigger multiple transactions that you will need to
                sign.
              </small>
            </form>
            <div className="footer-container" />
          </div>
        </div>
      </div>
    );
  }

  const mintNFT = () => {
    setIsClaiming(true);
    bundleDropModule
      .claim("0", 1)
      .catch((err) => {
        console.error("failed to claim", err);
        setIsClaiming(false);
      })
      .finally(() => {
        setIsClaiming(false);
        setHasClaimedNFT(true);
        console.log(
          `🌊 Successfully Minted! Check it out on OpenSea: https://testnets.opensea.io/assets/${bundleDropModule.address}/0`
        );
      });
  };
  return (
    <div className="mint-nft">
      <h1>Mint your NFT to enjoy our cool stuff just for DAO members only</h1>
      <button disabled={isClaiming} onClick={() => mintNFT()}>
        {isClaiming ? "Minting..." : "Mint now to gain access(FREE)"}
      </button>
      <div className="footer-container" />
    </div>
  );
};

export default App;