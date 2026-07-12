import {chromium} from 'playwright';

const baseUrl = process.env.STUDIO_URL || 'http://127.0.0.1:4178';

const main = async () => {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  try {
    await page.goto(baseUrl, {waitUntil: 'networkidle'});
    await page.evaluate(() => localStorage.removeItem('autocubes-operations-v1'));
    await page.reload({waitUntil: 'networkidle'});
    await page.getByRole('button', {name: 'CRM', exact: true}).click();
    await page.getByRole('button', {name: /Новый контакт/}).click();
    await page.getByLabel('Компания *').fill('QA Studio Client');
    await page.getByLabel('Контакт').fill('Мария');
    await page.getByLabel('Потенциал, ₽').fill('175000');
    await page.getByLabel('Следующее действие').fill('Назначить встречу');
    await page.getByRole('button', {name: /Добавить контакт/}).click();
    await page.getByText('QA Studio Client').waitFor();
    const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('autocubes-operations-v1') || '{}'));
    if (!persisted.leads?.some((lead: {company: string}) => lead.company === 'QA Studio Client')) throw new Error('CRM lead did not persist');

    await page.getByRole('button', {name: 'Проекты', exact: true}).click();
    await page.getByText('Flowline showcase').click();
    await page.getByRole('button', {name: /Дизайн/}).click();
    await page.getByPlaceholder('Добавить задачу на этот этап').fill('QA task');
    await page.getByRole('button', {name: 'Добавить', exact: true}).click();
    await page.waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'QA task'));

    await page.goto(`${baseUrl}/?view=reviews`, {waitUntil: 'networkidle'});
    await page.getByText('Главная страница — desktop').click();
    const canvas = page.locator('.ops-review-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Review canvas is not visible');
    await page.mouse.click(box.x + box.width * .32, box.y + box.height * .36);
    await page.getByPlaceholder('Что нужно изменить?').fill('Комментарий из QA');
    await page.getByRole('button', {name: /Отправить/}).click();
    await page.getByText('Комментарий из QA').waitFor();

    await page.goto(`${baseUrl}/?review=project-flowline`, {waitUntil: 'networkidle'});
    await page.getByRole('heading', {name: /Материалы/}).waitFor();
    await page.getByRole('button', {name: /Согласовать/}).click();
    await page.getByText('Согласовано').first().waitFor();
    console.log('Operations QA passed: CRM, projects, pinned review, and client approval');
  } finally {
    await browser.close();
  }
};

main().catch((error) => {console.error(error); process.exitCode = 1;});
