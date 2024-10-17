require('dotenv').config();
const {Web3} = require('web3');
const fs = require('fs');

console.log(`ankrAPIURL: ${process.env.ANKR_API_URL}`);
console.log(`contractAddress: ${process.env.CONTRACT_ADDRESS}`);

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ANKR_API_URL));

async function main() {
    const tokenAddress = process.env.CONTRACT_ADDRESS;
    const abi = [
        { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
        { "anonymous": false, "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }
    ];

    const contract = new web3.eth.Contract(abi, tokenAddress);

    // Fetch the latest block number
    const latestBlock = await web3.eth.getBlockNumber();

    // Map to store wallet addresses and balances
    const holders = new Map();

    console.log('Fetching Transfer events...');
    
    // Get all transfer events from the contract
    const events = await contract.getPastEvents('Transfer', {
        fromBlock: 0,
        toBlock: 'latest'
    });

    console.log(`Found ${events.length} Transfer events. Processing...`);

    // Process each transfer event to compute balances
    events.forEach(event => {
        const { from, to, value } = event.returnValues;
       
        // Update the sender's balance (subtract tokens)
        if (holders.has(from)) {
            holders.get(from).balance = holders.get(from).balance - parseFloat(web3.utils.fromWei(value, 'ether'));
        } else {
            holders.set(from, { balance: -parseFloat(web3.utils.fromWei(value, 'ether'))});
        }

        // Update the recipient's balance (add tokens)
        if (holders.has(to)) {
            holders.get(to).balance = holders.get(to).balance + parseFloat(web3.utils.fromWei(value, 'ether'));
        } else {
            holders.set(to, { balance: parseFloat(web3.utils.fromWei(value, 'ether'))});
        }
    });

    // Create a snapshot array with formatted data
    const snapshotData = [];
    holders.forEach((holder, address) => {
        if (holder.balance > 0) {
            snapshotData.push({
                address: address,
                balance: holder.balance.toFixed(18),  // Format balance to 18 decimals (like most ERC20 tokens)
            });
        }
    });

    // Write the data to a JSON file
    const fileName = `erc20_holders_snapshot_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(fileName, JSON.stringify(snapshotData, null, 2));

    console.log(`Snapshot saved to ${fileName}`);
}

main().catch(err => console.error('Error:', err));