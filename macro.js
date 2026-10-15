const api = game.modules.get("raven-step")?.api;
if (!api) return ui.notifications.error("Увімкни модуль Raven Step.");
const t = canvas.tokens.controlled[0];
if (!t?.actor) return ui.notifications.warn("Вибери токен персонажа.");
const item = t.actor.items.find(i => i.system.identifier === "blessing-of-the-raven-queen" || i.name === "Blessing of the Raven Queen");
if (!item) return ui.notifications.warn("На листі немає Blessing of the Raven Queen.");
try { await api.use(item); } catch (e) { ui.notifications.error(e.message); console.error(e); }
