import { expect, test } from "@playwright/test";

test("로그인 화면에서 공개 조회 화면을 모달로 열 수 있다", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");

  await expect(page.getByText("Project Management Tools")).toHaveCount(0);
  await expect(page.getByText("로그인 없이 조회")).toHaveCount(0);

  await page.getByRole("button", { name: "캘린더 조회" }).click();
  const calendarDialog = page.getByRole("dialog", { name: "캘린더" });
  await expect(calendarDialog).toBeVisible();
  await expect(calendarDialog.locator("iframe")).toHaveAttribute("src", "/calendar?embedded=1");
  const calendarFrame = calendarDialog.locator("iframe").contentFrame();
  await expect(calendarFrame.getByRole("heading", { name: "캘린더" })).toBeVisible();
  await expect(calendarFrame.getByRole("link", { name: "로그인" })).toHaveCount(0);
  await calendarFrame.getByRole("link", { name: "다음" }).click();
  await expect(calendarFrame.getByRole("link", { name: "로그인" })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "회의실 예약현황 조회" }).click();
  const meetingDialog = page.getByRole("dialog", { name: "회의실 예약현황" });
  await expect(meetingDialog).toBeVisible();
  await expect(meetingDialog.locator("iframe")).toHaveAttribute("src", "/meetrooms?embedded=1");
  const meetingFrame = meetingDialog.locator("iframe").contentFrame();
  await expect(meetingFrame.getByRole("heading", { name: "회의실 예약현황" })).toBeVisible({ timeout: 30_000 });
  await expect(meetingFrame.getByRole("link", { name: "로그인" })).toHaveCount(0);
});

test("비로그인 사용자는 캘린더를 조회만 할 수 있다", async ({ page }) => {
  await page.goto("/calendar");

  await expect(page).toHaveURL(/\/calendar/);
  await expect(page.getByRole("heading", { name: "캘린더" })).toBeVisible();
  await expect(page.getByText("로그인 없이 일정 조회만 가능합니다.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("link", { name: /일정 등록/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "검색" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "주요 이벤트" })).toHaveCount(0);
});

test("비로그인 사용자는 회의실 예약현황을 조회만 할 수 있다", async ({ page }) => {
  await page.goto("/meetrooms");

  await expect(page).toHaveURL(/\/meetrooms/);
  await expect(page.getByRole("heading", { name: "회의실 예약현황" })).toBeVisible();
  await expect(page.getByText("로그인 없이 예약현황 조회만 가능합니다.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "로그인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "내 예약" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "정기예약 신청" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /예약$/ })).toHaveCount(0);
});

test("비로그인 상태에서는 회의실 조회 GET만 허용한다", async ({ request }) => {
  const from = "2026-08-21T00:00:00+09:00";
  const to = "2026-08-22T00:00:00+09:00";
  const response = await request.get(`/api/v1/meeting-reservations?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  expect(response.ok()).toBe(true);
  expect(Array.isArray((await response.json()).data)).toBe(true);

  const writeResponse = await request.post("/api/v1/meeting-reservations", { data: {} });
  expect(writeResponse.status()).toBe(401);
});
