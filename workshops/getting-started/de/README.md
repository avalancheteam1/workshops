# Erste Schritte mit Avalanche

## Überblick

In diesem Workshop richtest du eine Wallet ein, holst dir Test-AVAX vom Fuji-Testnet-Faucet, sendest deine erste Transaktion und findest sie im Block-Explorer wieder. Am Ende weißt du, was das Primary Network ist, warum Avalanche mehr als eine Chain hat und wo Smart Contracts leben.

## Lernziele

- Das Primary Network und seine drei Chains (P-Chain, X-Chain, C-Chain) in je einem Satz erklären.
- Core Wallet installieren und auf das Fuji-Testnet umstellen.
- Eine Adresse über den Faucet aufladen und eine Transaktion senden.
- Eine Transaktion und eine Adresse im Fuji-Explorer finden.
- Die Fuji C-Chain per RPC-URL und Chain-ID in jeder EVM-Wallet hinzufügen.

## Voraussetzungen

- Ein Laptop mit Chrome, Brave oder Firefox.
- Keine Blockchain-Vorkenntnisse. Kein Guthaben nötig.

## Workshop

### Teil 1: Was ist Avalanche? (10 min)

Avalanche ist ein Netzwerk aus Blockchains. Das **Primary Network**, dem jeder Validator beitritt, hat drei Chains:

| Chain | Zweck | Du nutzt sie für |
|---|---|---|
| P-Chain | Plattform: Validatoren, Staking, neue Blockchains anlegen | Staking, eine L1 starten |
| X-Chain | Exchange: schnelle Asset-Transfers | Heute selten |
| C-Chain | Contract: eine EVM-Chain | Fast alles: dApps, Token, NFTs |

Neben dem Primary Network kann jeder eine eigene **Avalanche L1** (früher Subnet) starten, mit eigenen Validatoren, eigenem Gas-Token und eigenen Regeln. Der Workshop `build-your-first-dapp` bleibt auf der C-Chain. Spätere Workshops behandeln L1s.

Zwei Netzwerke sind für dich relevant:

- **Mainnet**: echte AVAX, echter Wert.
- **Fuji-Testnet**: kostenlose Test-AVAX, gleiche Software. Alles in diesem Workshop passiert auf Fuji.

### Teil 2: Core Wallet installieren (10 min)

1. Installiere die Core-Browser-Erweiterung von <https://go.team1.network/core>.
2. Lege eine neue Wallet an. Schreib die Wiederherstellungsphrase auf Papier. Tipp sie nie auf einer Website ein.
3. Öffne Einstellungen → Erweitert → aktiviere den **Testnet-Modus**. Der Kontostand zeigt jetzt Fuji.
4. Kopiere deine C-Chain-Adresse (beginnt mit `0x`).

Wenn du bereits MetaMask oder eine andere EVM-Wallet nutzt, füge Fuji stattdessen manuell hinzu:

| Feld | Wert |
|---|---|
| Netzwerkname | Avalanche Fuji C-Chain |
| RPC-URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| Chain-ID | `43113` |
| Währungssymbol | `AVAX` |
| Explorer | `https://testnet.snowtrace.io` |

### Teil 3: Builder-Hub-Konto anlegen (5 min)

Der Avalanche Builder Hub ist der Ort für Dokumentation, Academy-Kurse und den Faucet. Lege unter https://go.team1.network/builderhub ein Konto an und melde dich an. Du brauchst es für den nächsten Schritt und für jeden späteren Workshop.

### Teil 4: Test-AVAX holen (5 min)

1. Öffne den Faucet unter https://go.team1.network/faucet.
2. Wähle **Fuji (C-Chain)**, füge deine Adresse ein, fordere Token an. Frag die Workshop-Leitung nach einem Coupon-Code, falls der Faucet einen verlangt.
3. Innerhalb einer Minute aktualisiert sich der Kontostand in Core.

### Teil 5: Eine Transaktion senden (5 min)

1. Bildet Zweiergruppen. Tauscht Adressen aus.
2. Klicke in Core auf **Senden**, füge die Adresse deines Partners ein, sende 0,1 AVAX.
3. Notiere den Transaktions-Hash, den Core anzeigt.
4. Öffne https://testnet.snowtrace.io und füge den Hash ein. Finde:
   - die Blocknummer
   - das verbrauchte Gas und die bezahlte Gebühr
   - die Adressen `from` und `to`
5. Klicke auf deine Adresse. Du siehst jetzt jede Transaktion, an der sie beteiligt war. Das ist öffentlich, für immer.

Diskussion: Was bedeutet „Finalität“ hier, und wie lange hat sie gedauert?

### Teil 6: Die Chain ohne Wallet lesen (10 min)

Jede Wallet spricht per JSON-RPC mit einem Node. Das kannst du mit `curl` genauso:

```sh
curl -s https://api.avax-test.network/ext/bc/C/rpc \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0xDEINE_ADRESSE","latest"]}'
```

Das Ergebnis ist dein Kontostand in Wei als Hex-String. Durch 10^18 teilen ergibt AVAX.

Probiere auch `eth_blockNumber` und `eth_chainId`. Jedes dApp-Frontend, das du je bauen wirst, macht unter der Haube genau das.

## Übungen

1. **Chain-ID prüfen.** Rufe `eth_chainId` auf und wandle das Hex-Ergebnis in Dezimal um. Stimmt es mit der Tabelle in Teil 2 überein?
2. **Gebührenrechnung.** Berechne für deine Transaktion aus Teil 5: Gebühr = verbrauchtes Gas × Gaspreis aus dem Explorer. Vergleiche mit der angezeigten Gebühr.
3. **Explorer-Suche.** Finde den neuesten Block auf Fuji. Wie viele Transaktionen enthält er? Wie viele Sekunden liegen zwischen ihm und dem vorherigen Block?
4. **Zusatz.** Füge Fuji in einer zweiten Wallet (MetaMask) hinzu und importiere dieselbe Wiederherstellungsphrase. Prüfe, dass beide Wallets dieselbe Adresse und denselben Kontostand zeigen. Lösche diese Wallet danach wieder.

## Nächste Schritte

- Mach weiter mit [Build Your First dApp](../../build-your-first-dapp/en/README.md): einen Contract auf Fuji deployen und von einer Webseite aus aufrufen.
- Lies die Architektur-Übersicht in der unten verlinkten Dokumentation.

## Ressourcen

- [Avalanche-Dokumentation](https://go.team1.network/docs)
- [Core Wallet](https://go.team1.network/core)
- [Builder Hub](https://go.team1.network/builderhub)
- [Fuji-Faucet](https://go.team1.network/faucet)
- [Fuji-Explorer (Snowtrace)](https://testnet.snowtrace.io)
- [Öffentliche RPC-Endpunkte](https://build.avax.network/docs/tooling/rpc-providers)
