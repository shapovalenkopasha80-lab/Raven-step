const api = game.modules.get("raven-step")?.api;
if (!api) return ui.notifications.error("Увімкни модуль Raven Step.");
const t = canvas.tokens.controlled[0];
if (!t?.actor) return ui.notifications.warn("Вибери токен персонажа.");
const item = t.actor.items.find(i => i.type === "spell" && (i.system.identifier === "misty-step" || i.name.trim().toLowerCase() === "misty step"));
if (!item) return ui.notifications.warn("На листі немає Misty Step.");
try { await api.use(item); } catch (e) { ui.notifications.error(e.message); console.error(e); }
