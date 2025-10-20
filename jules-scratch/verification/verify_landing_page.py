from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:4173")
    page.wait_for_selector("text=Find Student Accommodation", timeout=5000)
    page.screenshot(path="jules-scratch/verification/landing_page.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
