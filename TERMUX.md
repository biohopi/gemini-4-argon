# Termux

```sh
pkg update -y && pkg install nodejs git -y
git clone https://github.com/biohopi/gemini-4-argon.git
cd gemini-4-argon
npm install
npm run dev -- -H 0.0.0.0
```

Open `http://127.0.0.1:3000` in the phone browser. Production test: `npm run build && npm start`.
