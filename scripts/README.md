# scripts/

`shots.mjs` — Screenshot-Tool über Chrome DevTools Protocol (Port 9223).

```
node scripts/shots.mjs <ausgabe-verzeichnis> '[["name",{"theme":"calm","mode":"advanced","tuning":{"layout":"force"}}]]'
```

Setzt localStorage (weave-theme / weave-mode / weave-tuning) vor dem Laden,
navigiert auf den Dev-Server (127.0.0.1:5174) und schreibt `<name>.png`.
