import { View } from 'react-native';
import { font, useTheme } from '../theme';
import { Eyebrow } from './ui';
import { TextButton } from './controls';

export const WizardBar = ({
  left,
  step,
  onLeft,
}: {
  left: string;
  step: string;
  onLeft: () => void;
}) => {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 2,
        paddingHorizontal: 22,
        paddingBottom: 18,
      }}>
      <TextButton
        label={left}
        onPress={onLeft}
        style={{ fontFamily: font.regular, fontSize: 13.5, color: c.mute }}
      />
      <Eyebrow>{step}</Eyebrow>
    </View>
  );
};
