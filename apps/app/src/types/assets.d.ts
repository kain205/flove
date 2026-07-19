// Static asset modules resolved by Metro. The value is an opaque source
// accepted by react-native's <Image source={...}>.
declare module '*.png' {
  const source: number;
  export default source;
}
