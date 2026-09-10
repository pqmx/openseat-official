import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { font, useTheme } from './theme';
import { connectionFromNetwork, type ConnectionState } from './connectivity-state';
import NetInfo from '@react-native-community/netinfo';

type ConnectionValue = { state: ConnectionState; retry: () => Promise<void> };
const ConnectionContext = createContext<ConnectionValue | undefined>(undefined);

export const useConnection = () => {
  const value = useContext(ConnectionContext);
  if (!value) throw new Error('useConnection outside ConnectionProvider');
  return value;
};

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ConnectionState>('checking');
  const retry = useCallback(async () => {
    try {
      const network = await NetInfo.refresh();
      setState(connectionFromNetwork(network));
    } catch { setState('offline'); }
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((network) => setState(connectionFromNetwork(network)));
    const appState = AppState.addEventListener('change', (next) => { if (next === 'active') void retry(); });
    return () => { unsubscribe(); appState.remove(); };
  }, [retry]);

  const value = useMemo(() => ({ state, retry }), [retry, state]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
};

export const ConnectionBanner = () => {
  const { state, retry } = useConnection();
  const { c } = useTheme();
  if (state !== 'offline') return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: c.ink,
        paddingHorizontal: 16,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
      <Text style={{ color: c.surface, fontFamily: font.medium, fontSize: 13, flex: 1 }}>
        You’re offline. Some rooms may be out of date.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry connection" onPress={retry}>
        <Text style={{ color: c.coral, fontFamily: font.bold, fontSize: 13 }}>Retry</Text>
      </Pressable>
    </View>
  );
};
