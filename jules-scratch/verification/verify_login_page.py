from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:4173/auth")
    page.wait_for_selector("text=Welcome Back", timeout=5000)
    page.screenshot(path="jules-scratch/verification/login_page.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
