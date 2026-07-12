import { chromium } from "playwright";

const baseUrl = process.env.STUDIO_URL || "http://127.0.0.1:4178";

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.addInitScript(() => sessionStorage.setItem("autocubes-sync-disabled", "true"));
  page.setDefaultTimeout(7_000);
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.evaluate(() =>
      localStorage.removeItem("autocubes-operations-v1"),
    );
    await page.reload({ waitUntil: "networkidle" });

    await page
      .locator(".ops-sidebar nav button")
      .filter({ hasText: "CRM" })
      .click();
    await page.getByRole("button", { name: /Новый контакт/ }).click();
    const leadDialog = page.getByRole("dialog", { name: "Новый контакт" });
    await leadDialog.getByLabel("Компания *").fill("QA Studio Client");
    await leadDialog.getByPlaceholder("Имя и роль").fill("Мария, основатель");
    await leadDialog.getByLabel("Потенциал, ₽").fill("175000");
    await leadDialog.getByLabel("Следующее действие").fill("Назначить встречу");
    await leadDialog.getByRole("button", { name: /Добавить контакт/ }).click();
    await page
      .locator(".crm-lead-list > button")
      .filter({ hasText: "QA Studio Client" })
      .waitFor();
    await page
      .locator(".crm-stage-picker")
      .getByRole("button", { name: "Связались" })
      .click();
    await page
      .getByPlaceholder("Записать результат разговора")
      .fill("Получен бриф");
    await page.getByLabel("Добавить заметку").click();
    await page.getByRole("button", { name: /Создать проект/ }).click();

    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("autocubes-operations-v1") || "{}"),
    );
    const lead = persisted.leads?.find(
      (item: { company: string }) => item.company === "QA Studio Client",
    );
    if (lead?.stage !== "won")
      throw new Error(
        "CRM stage or lead-to-project conversion did not persist",
      );
    if (
      !lead.activities?.some(
        (item: { text: string }) => item.text === "Получен бриф",
      )
    )
      throw new Error("CRM activity did not persist");

    await page
      .locator(".ops-sidebar nav button")
      .filter({ hasText: "Проекты" })
      .click();
    await page.getByText("QA Studio Client", { exact: true }).first().click();
    await page.getByPlaceholder("Добавить задачу на этот этап").fill("QA task");
    await page.getByRole("button", { name: "Добавить", exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("input")].some(
        (input) => input.value === "QA task",
      ),
    );
    await page.getByLabel("Настройки проекта").click();
    await page.getByLabel("Состояние").selectOption("attention");
    await page.getByRole("button", { name: /Готово/ }).click();

    await page.goto(`${baseUrl}/?view=reviews`, { waitUntil: "networkidle" });
    const stage = page.locator(".review-stage-viewport");
    const box = await stage.boundingBox();
    if (!box) throw new Error("Review stage is not visible");
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.38);
    await page
      .getByPlaceholder("Что нужно изменить?")
      .fill("Комментарий из QA");
    await page.getByRole("button", { name: /Отправить/ }).click();
    await page.getByText("Комментарий из QA").waitFor();
    await page.getByRole("button", { name: /Новая версия/ }).click();
    await page
      .getByRole("dialog", { name: /Новая версия/ })
      .getByRole("button", { name: /Создать v4/ })
      .click();
    await page
      .getByText(/версия 4/i)
      .first()
      .waitFor();

    await page.goto(`${baseUrl}/?review=project-flowline`, {
      waitUntil: "networkidle",
    });
    await page.locator(".client-review-app").waitFor();
    await page.getByRole("button", { name: /Согласовать версию/ }).click();
    await page.getByRole("button", { name: "Согласовано" }).waitFor();

    await page.goto(`${baseUrl}/?view=library`, { waitUntil: "networkidle" });
    await page
      .locator(".ops-library-card")
      .first()
      .getByRole("button", { name: /Подробнее/ })
      .click();
    await page
      .locator(".library-project-links")
      .getByRole("button")
      .first()
      .click();
    const linked = await page
      .locator(".library-project-links button.active")
      .count();
    if (!linked) throw new Error("Library project link did not update");

    await page.keyboard.press("Control+K");
    await page.getByPlaceholder(/Проект, клиент, материал/).fill("Flowline");
    await page
      .locator(".ops-command-result")
      .filter({ hasText: "Flowline showcase" })
      .waitFor();
    console.log(
      "Operations QA passed: CRM, project OS, compact reviews, client approval, library, and command search",
    );
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
