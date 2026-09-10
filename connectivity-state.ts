export type ConnectionState = 'checking' | 'online' | 'offline';

export const connectionFromNetwork = (network: { isConnected: boolean | null; isInternetReachable: boolean | null }): ConnectionState =>
  network.isConnected === false || network.isInternetReachable === false ? 'offline'
    : network.isConnected === true && network.isInternetReachable === true ? 'online' : 'checking';
