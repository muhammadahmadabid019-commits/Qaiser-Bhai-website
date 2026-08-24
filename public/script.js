const btn  = document.getElementById("hamburgerBtn");
const menu = document.getElementById("navLinks");

btn.addEventListener("click", function () {
  btn.classList.toggle("open");
  menu.classList.toggle("open");
});

document.querySelectorAll("#navLinks .nav-link").forEach(function (link) {
  link.addEventListener("click", function () {
    btn.classList.remove("open");
    menu.classList.remove("open");
  });
});

document.addEventListener("click", function (e) {
  if (!e.target.closest("#mainNavbar")) {
    btn.classList.remove("open");
    menu.classList.remove("open");
  }
  
  const dismissBtn = e.target.closest('[data-bs-dismiss="alert"], .btn-close, .alert-close');
  if (dismissBtn) {
    const alertContainer = dismissBtn.closest('.flash-messages-overlay .container, .alert, .success-box, .error-box');
    if (alertContainer) {
      alertContainer.remove();
    }
  }
});

document.querySelectorAll(".product-card-clickable").forEach(function (card) {
  card.addEventListener("click", function (e) {
    // Let the "Add to Cart" form (and anything else meant to act in place,
    // like its submit button) handle its own click instead of also
    // navigating the whole card away to the product page.
    if (e.target.closest("form")) return;
    window.location = card.dataset.href;
  });
});

// Show/Hide password toggle — works for any .password-field wrapper,
// so it covers login, signup, and any future password field that uses
// the same markup without needing page-specific script.
function togglePasswordVisibility(icon) {
  const input = icon.previousElementSibling;
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  icon.innerHTML = isHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
  icon.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
}

document.querySelectorAll(".password-toggle-icon").forEach(function (icon) {
  icon.addEventListener("click", function () {
    togglePasswordVisibility(icon);
  });
  icon.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePasswordVisibility(icon);
    }
  });
});
