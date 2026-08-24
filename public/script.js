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
  card.addEventListener("click", function () {
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

$(document).ready(function () {

  // Initialize the Slick carousel on the element with id "productCarousel"
  $('#productCarousel').slick({

    // Show 3 cards at the same time on desktop
    slidesToShow: 3,

    // Move 1 card at a time when clicking next/prev
    slidesToScroll: 1,

    // When it reaches the last card, go back to first (loop forever)
    infinite: true,

    // Auto slide every 5 seconds automatically
    autoplay: true,

    // 5000 milliseconds = 5 seconds between each auto slide
    autoplaySpeed: 5000,

    // Use my custom Previous button with id "prevBtn"
    prevArrow: $('#prevBtn'),

    // Use my custom Next button with id "nextBtn"
    nextArrow: $('#nextBtn'),

    // Responsive breakpoints for different screen sizes
    responsive: [
      {
        // When screen width is 992px or smaller (tablet)
        breakpoint: 992,
        settings: {
          // Show only 2 cards on tablet
          slidesToShow: 2,
          slidesToScroll: 1
        }
      },
      {
        // When screen width is 576px or smaller (mobile)
        breakpoint: 576,
        settings: {
          // Show only 1 card on mobile
          slidesToShow: 1,
          slidesToScroll: 1
        }
      }
    ]

  });

  // Listen for when the slide changes (after every slide move)
  $('#productCarousel').on('afterChange', function(event, slick, currentSlide) {

    // currentSlide starts from 0 so we add 1 to make it human readable
    var slideNumber = currentSlide + 1;

    // Total number of products we have
    var totalSlides = 6;

    // Update the counter text to show current slide number
    $('#slideCounter').text('Showing ' + slideNumber + ' of ' + totalSlides);

  });

  // When mouse enters a product card, pause the autoplay
  $('.product-card').on('mouseenter', function() {
    $('#productCarousel').slick('slickPause');
  });

  // When mouse leaves a product card, resume the autoplay
  $('.product-card').on('mouseleave', function() {
    $('#productCarousel').slick('slickPlay');
  });

});
