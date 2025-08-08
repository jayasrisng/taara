# 🌌 Taara - A Constellation Game

A simple browser-based **click-to-connect puzzle** where you form a constellation by linking only the correct star pairs.  

## 🎯 Goal
Connect the stars in the correct pattern to complete the **constellation**.  
Each star has a **maximum number of allowed connections** based on its real position in the constellation.

---

## 🕹 How to Play
- **Click** one star, then another to draw a connection.
- You can **only** connect stars if the connection exists in the real constellation.
- The **number** below each star shows how many connections it has made out of the allowed total.
- Use the **Hint** button (or press `H`) to show the target constellation faintly.
- Use the **Reset** button (or press `R`) to clear all lines.

You win when all correct connections are made — the game will display  
`You formed GEMINI! ✨`.

---

## 🖥 Controls
| Action      | Method                           |
|-------------|----------------------------------|
| Connect     | Click one star, then another     |
| Toggle Hint | `H` key or **Hint** button       |
| Reset       | `R` key or **Reset** button      |

---

## 🚀 Run Locally
Clone the repo and open `index.html` in your browser:
```bash
git clone https://github.com/<your-username>/taara.git
cd taara
open index.html   # macOS
# or double-click index.html
