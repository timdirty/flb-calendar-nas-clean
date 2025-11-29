/**
 * Integration test: Upload resilience under route switches + comment editing
 * Requires dev server running at http://localhost:3002
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function ensureTestFiles() {
  const dir = path.join('/tmp');
  const jpg = path.join(dir, 'puppeteer-test.jpg');
  const mp4 = path.join(dir, 'puppeteer-test.mp4');
  if (!fs.existsSync(jpg)) fs.writeFileSync(jpg, Buffer.from('FFD8FFE0', 'hex'));
  if (!fs.existsSync(mp4)) fs.writeFileSync(mp4, 'MP4');
  return { jpg, mp4 };
}

async function pickFirstCourse(page) {
  await page.waitForSelector('#courseList .course-item', { timeout: 20000 });
  // Try up to 6 courses to ensure the picked one has students
  const items = await page.$$('#courseList .course-item');
  if (!items || items.length === 0) throw new Error('No course items found');
  for (let i = 0; i < Math.min(items.length, 6); i++) {
    await items[i].click();
    try {
      await waitStudents(page); // quickly try
      return; // success
    } catch (_) {
      // go back to select step and try next
      await page.evaluate(() => { try { window.FLB && FLB.Router && FLB.Router.navigate({ step: 'select' }); } catch (e) {} });
      await page.waitForSelector('#courseList .course-item', { timeout: 20000 });
    }
  }
  throw new Error('Unable to find a course with student inputs');
}

async function waitStudents(page) {
  await page.waitForSelector('#studentsGrid', { timeout: 20000 });
  // any student inputs
  await page.waitForSelector('input[id^="photos-"]', { timeout: 20000 });
  await page.waitForSelector('input[id^="videos-"]', { timeout: 20000 });
}

async function uploadFilesAndEdit(page, files) {
  // Attach files
  const photoInput = await page.$('input[id^="photos-"]');
  const videoInput = await page.$('input[id^="videos-"]');
  await photoInput.uploadFile(files.jpg);
  await videoInput.uploadFile(files.mp4);

  // Type comment while uploading
  const commentEl = await page.$('textarea[id^="comment-"]');
  if (commentEl) {
    await commentEl.type(' 自動化測試：上傳期間可編輯');
  }

  // Expect at least one uploading overlay shows up
  await page.waitForSelector('.file-preview.uploading .file-uploading-overlay .progress-text', { timeout: 20000 });
}

async function switchRoutes(page) {
  // Switch to overview and back to student
  await page.evaluate(() => { try { window.FLB && FLB.Router && FLB.Router.navigate({ step: 'overview' }); } catch (e) {} });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { try { window.FLB && FLB.Router && FLB.Router.navigate({ step: 'student' }); } catch (e) {} });
  await new Promise(r => setTimeout(r, 1200));
  // Go to select then back to first course
  await page.evaluate(() => { try { window.FLB && FLB.Router && FLB.Router.navigate({ step: 'select' }); } catch (e) {} });
  await page.waitForSelector('#courseList .course-item', { timeout: 20000 });
  await page.click('#courseList .course-item');
  await waitStudents(page);
}

async function assertCompleted(page) {
  // Wait until at least one preview becomes upload-success
  await page.waitForFunction(() => !!document.querySelector('.file-preview.upload-success'), { timeout: 60000 });
  const ok = await page.evaluate(() => {
    const success = document.querySelectorAll('.file-preview.upload-success').length;
    const overlays = Array.from(document.querySelectorAll('.file-preview .file-uploading-overlay'))
      .filter(o => getComputedStyle(o).display !== 'none').length;
    return { success, overlays };
  });
  return ok;
}

(async () => {
  const files = await ensureTestFiles();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto('http://localhost:3002/learning-record-upload.html', { waitUntil: 'networkidle2' });
    await pickFirstCourse(page);
    await waitStudents(page);
    await uploadFilesAndEdit(page, files);
    await switchRoutes(page);
    const result = await assertCompleted(page);
    console.log('✅ Upload finished with previews:', result);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    try { await page.screenshot({ path: '/tmp/upload-resilience-failure.png', fullPage: true }); } catch (_) {}
    await browser.close();
    process.exit(1);
  }
})();
