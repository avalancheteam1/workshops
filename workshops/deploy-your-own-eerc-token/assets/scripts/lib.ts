// Shared helpers for the workshop scripts.
// Copy this file, with the others in this folder, into scripts/ of your EncryptedERC clone.
import fs from "node:fs";
import path from "node:path";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/dist/src/signer-with-address";
import { Base8, mulPointEscalar, subOrder } from "@zk-kit/baby-jubjub";
import { formatPrivKeyForBabyJub } from "maci-crypto";
import { ethers } from "hardhat";
import { User } from "../test/user";
import {
	EncryptedERC__factory,
	Registrar__factory,
} from "../typechain-types";

// Where each account's BabyJubJub private key is saved between runs.
// `new User(signer)` draws a fresh random key every time, so without this file
// a second script run would have a different key and could not decrypt anything.
const KEY_FILE = path.join(__dirname, "..", ".eerc-keys.json");

export const loadUser = (signer: SignerWithAddress): User => {
	const user = new User(signer);
	const keys: Record<string, string> = fs.existsSync(KEY_FILE)
		? JSON.parse(fs.readFileSync(KEY_FILE, "utf8"))
		: {};
	const id = signer.address.toLowerCase();

	if (keys[id]) {
		user.privateKey = BigInt(keys[id]);
	} else {
		keys[id] = user.privateKey.toString();
		fs.writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));
	}

	user.formattedPrivateKey = formatPrivKeyForBabyJub(user.privateKey) % subOrder;
	user.publicKey = mulPointEscalar(Base8, user.formattedPrivateKey).map((x) =>
		BigInt(x),
	);
	return user;
};

export const getContracts = async () => {
	const { REGISTRAR, ENCRYPTED_ERC } = process.env;
	if (!REGISTRAR || !ENCRYPTED_ERC) {
		throw new Error("Set REGISTRAR and ENCRYPTED_ERC in .env (printed by deploy.ts)");
	}
	const [signer] = await ethers.getSigners();
	return {
		registrar: Registrar__factory.connect(REGISTRAR, signer),
		encryptedERC: EncryptedERC__factory.connect(ENCRYPTED_ERC, signer),
	};
};

export const getAuditorPublicKey = async (): Promise<bigint[]> => {
	const { encryptedERC } = await getContracts();
	const key = await encryptedERC.auditorPublicKey();
	if (key.x === 0n) {
		throw new Error("Auditor not set yet. Run set-auditor.ts first.");
	}
	return [key.x, key.y];
};

// The token uses whole units of its smallest denomination.
// With 2 decimals, 1000 means 10.00 tokens.
export const amountFromEnv = (fallback: bigint): bigint =>
	process.env.AMOUNT ? BigInt(process.env.AMOUNT) : fallback;
