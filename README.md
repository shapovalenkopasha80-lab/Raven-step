# Raven Step — Shadar-Kai & Misty Step

Модуль Foundry VTT: вибір точки в межах 30 футів, телепортація токена, тіньові частинки та звук. Підтримує Blessing of the Raven Queen і Misty Step; для Misty Step зберігає штатне використання комірок D&D5e.

Цільові версії: Foundry 14.368 та D&D5e 6.0.6. Без сторонніх залежностей. Локальні тести з імітацією API пройдено; живе тестування у Foundry ще потрібне. Опір Raven Queen застосовується вручну.

## Перша публікація через сайт GitHub

1. Створи **публічний** репозиторій `raven-step`. Це зробить код і звук доступними всім; файлів кампанії чи персонажів у цьому пакеті немає.
2. Через **Add file → Upload files** завантаж **вміст** цієї папки, а не сам ZIP і не зовнішню папку. У корені репозиторію мають бути `module.json`, `scripts`, `assets`, `tools`, `tests` та `.github`.
3. Перевір, що існує `.github/workflows/release.yml`. Якщо прихована папка не завантажилася, вибери **Add file → Create new file**, введи `.github/workflows/release.yml` і встав вміст однойменного файлу з архіву. Збережи через Commit changes.
4. Відкрий **Releases → Create a new release**. Створи тег **`v1.1.0`** на гілці з завантаженими файлами. Назва: `Raven Step 1.1.0`. Не позначай як pre-release; опублікуй через **Publish release**.
5. На вкладці **Actions** дочекайся зеленої позначки біля **Build Foundry Release**. Workflow перевірить код і додасть до релізу `module.json` та `raven-step.zip`.
6. Відкрий реліз. У **Assets** скопіюй адресу вкладення **module.json** (правою кнопкою → Copy link address). Це вже готовий Manifest URL для встановлення конкретної версії. Стале посилання для останньої версії також показується у підсумку виконання Actions.

Стале посилання має формат (OWNER/REPOSITORY заміни своєю адресою):

```
https://github.com/OWNER/REPOSITORY/releases/latest/download/module.json
```

Кореневий `module.json` — вихідний шаблон. Workflow сам вставляє реальні `url`, `manifest` і `download`; для встановлення використовуй **вкладення релізу**, а не Raw-файл з кореня. `Source code (zip)`, який GitHub створює сам, теж не є інсталяційним архівом.

## Встановлення на Molten Hosting

У Foundry вийди до Setup → Add-on Modules → Install Module → встав Manifest URL → Install. Потім запусти світ → Game Settings → Manage Modules → увімкни **Raven Step — Shadar-Kai & Misty Step** → Save Module Settings.

Якщо вже встановлював модуль вручну: збережи резервну копію папки raven-step, у Setup видали стару інсталяцію Raven Step і встанови через Manifest URL. Після цього знову перевір галочку у світі. Видаляється лише пакет модуля, а не здібності чи персонажі. Не видаляй папку світу.

## Наступні релізи

Онови код і поле `version` у кореневому `module.json`, наприклад на `1.1.1`. Створи реліз із тегом `v1.1.1`. Версія й тег мають збігатися. Після завершення Actions користувачі можуть оновити модуль через Foundry. Для звичайних релізів залишай pre-release вимкненим, щоб працював latest URL.

## Якщо Actions не запускається

Перевір наявність `.github/workflows/release.yml` у коміті релізу та дозвіл GitHub Actions для репозиторію. Workflow використовує вбудований GitHub token з `contents: write`; особистий токен вставляти в код не потрібно. Якщо виконання впало, відкрий червоний запуск і його помилку. Після виправлення створи новий тег/реліз з новою версією; якщо причина тимчасова, можна використати Re-run jobs.

Ручний запасний варіант з установленим Python 3:

```
python tools/build_release.py --repository YOUR_NAME/raven-step --tag v1.1.0
```

Прикріпи обидва файли з `dist` до релізу `v1.1.0` вручну. YOUR_NAME — твій GitHub username; це приклад, а не готовий URL.

## Використання та обмеження

Дивись [README_UA.md](README_UA.md). Додаткові макроси необов'язкові. Вимкни дублюючу телепортацію в інших модулях для цих здібностей. Код і синтезований звук можна використовувати та змінювати у власних світах.

## Перевірки

```
node --check scripts/raven-step.mjs
node --test tests/raven-step.test.mjs
```

## Документація

- https://foundryvtt.com/article/module-development/
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-github-cli
