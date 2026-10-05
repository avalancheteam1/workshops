// Private transfer from the first account (PRIVATE_KEY) to the second (PRIVATE_KEY_2).
// Run with (AMOUNT is optional, default 250 = 2.50 tokens at 2 decimals):
//   AMOUNT=250 npx hardhat run scripts/transfer.ts --network fuji
import { ethers } from "hardhat";
import { getDecryptedBalance, privateTransfer } from "../test/helpers";
import { amountFromEnv, getAuditorPublicKey, getContracts, loadUser } from "./lib";

const main = async () => {
	const [senderSigner, receiverSigner] = await ethers.getSigners();
	if (!receiverSigner) {
		throw new Error("Set PRIVATE_KEY_2 in .env: the transfer needs a receiver account.");
	}
	const { encryptedERC } = await getContracts();
	const amount = amountFromEnv(250n);

	const sender = loadUser(senderSigner);
	const receiver = loadUser(receiverSigner);
	const auditorPublicKey = await getAuditorPublicKey();

	// The proof needs the sender's current plaintext balance, so decrypt it first.
	const current = await encryptedERC.balanceOfStandalone(senderSigner.address);
	const senderBalance = await getDecryptedBalance(
		sender.privateKey,
		current.amountPCTs,
		current.balancePCT,
		current.eGCT,
	);
	console.log(`Sender balance: ${senderBalance} units. Transferring ${amount}...`);

	const { proof, senderBalancePCT } = await privateTransfer(
		sender,
		senderBalance,
		receiver.publicKey,
		amount,
		[...current.eGCT.c1, ...current.eGCT.c2],
		auditorPublicKey,
	);

	// The on-chain function is `transfer`. tokenId 0 is the standalone token.
	const tx = await encryptedERC
		.connect(senderSigner)
		[
			"transfer(address,uint256,((uint256[2],uint256[2][2],uint256[2]),uint256[32]),uint256[7])"
		](receiverSigner.address, 0n, proof, senderBalancePCT);
	const receipt = await tx.wait();

	console.log(`Transferred ${amount} units to ${receiverSigner.address}. tx: ${tx.hash}`);
	console.log(`  gas used: ${receipt?.gasUsed}`);
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
