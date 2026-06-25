// Lets us import individual font files by deep path so Metro bundles only the
// weights we actually use — importing from the @expo-google-fonts barrel would
// pull in every weight + italic (~12MB).
declare module "*.ttf";
