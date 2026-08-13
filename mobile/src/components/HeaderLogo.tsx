import React from 'react';
import { Image, StyleSheet } from 'react-native';

export function HeaderLogo(): React.JSX.Element {
  return <Image source={require('../../assets/edvance-logo.png')} style={styles.logo} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  logo: { height: 28, width: 130 },
});
