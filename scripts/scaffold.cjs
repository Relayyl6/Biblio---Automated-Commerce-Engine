const fs = require('fs');
const path = require('path');

// 1. package.json entry
const pkgPath = 'ace-merchant-app/package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.main = 'expo-router/entry';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

// 2. app.json
const appJsonPath = 'ace-merchant-app/app.json';
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
appJson.expo.scheme = 'acemerchant';
if (!appJson.expo.plugins) appJson.expo.plugins = [];
if (!appJson.expo.plugins.includes('expo-router')) appJson.expo.plugins.push('expo-router');
if (!appJson.expo.web) appJson.expo.web = {};
appJson.expo.web.bundler = 'metro';
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

// 3. tailwind.config.js
const twConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
fs.writeFileSync('ace-merchant-app/tailwind.config.js', twConfig);

// 4. babel.config.js
const babelConfig = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
`;
fs.writeFileSync('ace-merchant-app/babel.config.js', babelConfig);

// 5. metro.config.js
const metroConfig = `const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
`;
fs.writeFileSync('ace-merchant-app/metro.config.js', metroConfig);

// 6. global.css
fs.writeFileSync('ace-merchant-app/global.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');

// 7. app directory and layout
fs.mkdirSync('ace-merchant-app/app/(tabs)', { recursive: true });
const rootLayout = `import '../global.css';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}
`;
fs.writeFileSync('ace-merchant-app/app/_layout.tsx', rootLayout);

// 8. Delete App.tsx and index.ts (replaced by expo-router)
if (fs.existsSync('ace-merchant-app/App.tsx')) fs.unlinkSync('ace-merchant-app/App.tsx');
if (fs.existsSync('ace-merchant-app/index.ts')) fs.unlinkSync('ace-merchant-app/index.ts');

console.log('App scaffolded correctly for Expo Router and NativeWind');
