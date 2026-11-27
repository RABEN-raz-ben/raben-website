(() => {
  "use strict";
  const form = document.getElementById("contact-form");
  if (!form) return;

  const send = document.getElementById("send-contact");
  const status = document.getElementById("mail-status");
  const fallback = " הפרטים נשארו בטופס. אפשר לפנות במייל או באינסטגרם.";
  let sending = false;

  form.addEventListener("input", () => {
    if (!sending) status.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;

    const data = new FormData(form);
    if (data.get("website")) {
      status.textContent = "בדקו את הפרטים ונסו שוב." + fallback;
      return;
    }
    data.delete("website");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    sending = true;
    send.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent = "שולחים את ההודעה…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
        signal: controller.signal,
        redirect: "error",
        credentials: "omit"
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.ok === true) {
        if ([...data].every(([key, value]) => form.elements[key]?.value === value)) {
          form.reset();
        }
        status.textContent = "תודה, ההודעה התקבלה בשירות הטפסים.";
      } else if (response.status === 429) {
        status.textContent = "התקבלו יותר מדי בקשות. אפשר לנסות שוב מאוחר יותר." + fallback;
      } else if (response.status === 422) {
        status.textContent = "שירות הטפסים לא קיבל את הפרטים. בדקו אותם ונסו שוב." + fallback;
      } else {
        status.textContent = "לא התקבל אישור שליחה." + fallback;
      }
    } catch {
      status.textContent = "לא התקבל אישור שליחה. לפני שליחה נוספת כדאי לבדוק אם קיבלתם תשובה." + fallback;
    } finally {
      clearTimeout(timer);
      sending = false;
      send.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });
})();
