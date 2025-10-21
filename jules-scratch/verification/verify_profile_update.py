from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:4173/profile")

    # Wait for the page to load
    expect(page.get_by_text("My Profile")).to_be_visible()

    # Click the edit button
    page.get_by_role("button", name="Edit Profile").click()

    # Edit the full name
    name_input = page.get_by_label("Full Name")
    name_input.fill("Jules Verne")

    # Save the changes
    page.get_by_role("button", name="Save Changes").click()

    # Wait for the change to be reflected
    expect(page.get_by_text("Jules Verne")).to_be_visible()

    page.screenshot(path="jules-scratch/verification/profile_update.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
