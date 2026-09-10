import assert from 'node:assert/strict';
import { connectionFromNetwork } from './connectivity-state.ts';

for (const isConnected of [true, false, null]) {
  for (const isInternetReachable of [true, false, null]) {
    const expected = isConnected === false || isInternetReachable === false ? 'offline'
      : isConnected === true && isInternetReachable === true ? 'online' : 'checking';
    assert.equal(connectionFromNetwork({ isConnected, isInternetReachable }), expected);
  }
}
console.log('connectivity checks passed: all nine native reachability states');
