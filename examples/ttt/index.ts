import * as dgame from 'dgame'
import * as ethers from 'ethers'
import * as wsrelay from 'wsrelay'

class Matcher {
  constructor(private game: string) {
  }

  async sendSecretSeed(subkeyAddress: string, subkeySignature: dgame.Signature, secretSeed: Uint8Array) {
    const seed64 = base64(secretSeed)
    const r64 = base64(subkeySignature.r)
    const s64 = base64(subkeySignature.s)

    this.relay = new wsrelay.Relay(`localhost`, 8000, false, seed64, new wsrelay.Signature(subkeySignature.v, r64, s64), subkeyAddress, 1)

    const response = JSON.parse((await this.relay.connectForTimestamp()).payload)

    this.matchID = response.matchID
    this.timestamp = response.timestamp

    return response
  }

  async sendTimestampSignature(timestampSignature: dgame.Signature): Promise<dgame.MatchInterface> {
    this.relay.send(JSON.stringify({
      gameID: 1,
      matchID: this.matchID,
      timestamp: this.timestamp,
      signature: {
        v: timestampSignature.v,
        r: base64(timestampSignature.r),
        s: base64(timestampSignature.s)
      }
    }), 2)

    return JSON.parse((await this.relay.connectForMatchVerified()).payload)
  }

  private relay: wsrelay.Relay
  private matchID: number
  private timestamp: number
}

async function main(): Promise<void> {
  const gameAddress = `0xc89ce4735882c9f0f0fe26686c53074e09b0d550`
  const ttt = new dgame.DGame(gameAddress, new Matcher(gameAddress))

  console.log(await ttt.matchDuration)
  console.log(await ttt.isSecretSeedValid(`0x0123456789012345678901234567890123456789`, new Uint8Array(0)))

  const {
    match: match0,
    XXX: {
      subkeySignature: subkeySignature0,
      timestampSignature: timestampSignature0
    }
  } = await ttt.createMatch(new Uint8Array(0))

  const {
    match: match1,
    XXX: {
      subkeySignature: subkeySignature1,
      timestampSignature: timestampSignature1
    }
  } = await ttt.createMatch(new Uint8Array(0))

  match0.opponentSubkeySignature = subkeySignature1
  match0.opponentTimestampSignature = timestampSignature1

  match1.playerID = 1
  match1.opponentSubkeySignature = subkeySignature0
  match1.opponentTimestampSignature = timestampSignature0

  const provider = new ethers.providers.Web3Provider((window as any).web3.currentProvider)
  const accounts = await provider.listAccounts()
  const arcadeumAddress = `0xcfeb869f69431e42cdb54a4f4f105c19c080a601`
  const arcadeumMetadata = require(`../../build/contracts/Arcadeum.json`)
  const arcadeumContract = new ethers.Contract(arcadeumAddress, arcadeumMetadata.abi, provider)
  const matchKey = new ethers.Wallet(`0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d`, provider)
  const matchHash = await arcadeumContract.matchHash(match0.game, match0.matchID, match0.timestamp, [accounts[0], accounts[0]], [0, 0], [[`0x0000000000000000000000000000000000000000000000000000000000000000`], [`0x0000000000000000000000000000000000000000000000000000000000000000`]])
  const matchSignatureValues = new ethers.SigningKey(matchKey.privateKey).signDigest(matchHash)
  const matchSignature = {
    v: 27 + matchSignatureValues.recoveryParam,
    r: ethers.utils.padZeros(ethers.utils.arrayify(matchSignatureValues.r), 32),
    s: ethers.utils.padZeros(ethers.utils.arrayify(matchSignatureValues.s), 32)
  }

  match0.matchSignature = matchSignature
  match1.matchSignature = matchSignature

  console.log(match0)
  console.log(match1)

  const p = async (sender: dgame.Match, receiver: dgame.Match, square: number) => {
    const move = new dgame.Move({
      playerID: sender.playerID,
      data: new Uint8Array([square])
    })

    console.log(move)

    await sender.commit(move)
    await receiver.commit(move)

    console.log(sender)
    console.log(receiver)
  }

  const p0 = async (square: number) => p(match0, match1, square)
  const p1 = async (square: number) => p(match1, match0, square)

  await p0(0)
  await p1(4)
  await p0(8)
  await p1(2)
  await p0(6)
  await p1(3)
  await p0(7)
}

function base64(data: Uint8Array): string {
  return new Buffer(ethers.utils.hexlify(data)).toString(`base64`)
}

main()