## Test

```bash
forge test
```

## Deployment

```bash
# Deploy Test Token
forge script script/DeployTestToken.s.sol:DeployTestToken --rpc-url=https://sepolia.base.org --broadcast

# Deploy PasskeyAccountFactory
forge script script/DeployPasskeyAccountFactory.s.sol:DeployPasskeyAccountFactory --rpc-url=https://sepolia.base.org --broadcast
```