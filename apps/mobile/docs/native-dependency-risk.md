# Native dependency risk register

`react-native-nitro-image` is excluded from Expo Doctor's React Native
Directory metadata check because it is a peer dependency of VisionCamera 5,
which powers Pore's native three-angle scan. The directory currently marks the
package as untested on React Native's New Architecture; exclusion is not an
assertion of compatibility.

Every release candidate must therefore run the physical-device scan protocol
on the supported iPhone matrix. Remove the exclusion when the directory marks
the dependency compatible or when the camera stack no longer requires it.
