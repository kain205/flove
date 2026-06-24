import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** Animates an integer from 0 to `target` on mount (and whenever target changes). */
export function useCountUp(target: number, { duration = 900, delay = 0, animate = true } = {}) {
  const value = useRef(new Animated.Value(animate ? 0 : target)).current;
  const [display, setDisplay] = useState(animate ? 0 : target);

  useEffect(() => {
    if (!animate) {
      value.setValue(target);
      setDisplay(target);
      return;
    }
    const id = value.addListener(({ value: v }) => setDisplay(Math.round(v)));
    const anim = Animated.timing(value, {
      toValue: target,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      value.removeListener(id);
      anim.stop();
    };
  }, [target, duration, delay, animate, value]);

  return display;
}
