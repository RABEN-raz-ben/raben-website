// Native disclosures and anchor links also work without this enhancement.
document.querySelectorAll('[data-service-kind]').forEach(link => {
  link.addEventListener('click', () => {
    const field = document.getElementById('kind');
    if (!field || field.disabled) return;
    field.value = link.dataset.serviceKind;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });
});
