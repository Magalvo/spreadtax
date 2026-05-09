// https://developer.mozilla.org/en-US/docs/Web/API/Window/DOMContentLoaded_event
document.addEventListener('DOMContentLoaded', () => {
  console.log('library-project JS imported successfully!');
});

const buttons = document.querySelectorAll('.btn-group-toggle .btn');
buttons.forEach(button => {
  button.addEventListener('click', () => {
    buttons.forEach(otherButton => otherButton.classList.remove('active'));
    button.classList.add('active');
  });
});

// Select the container
const container = document.querySelector('#animation-container');

if (container) {
  // Create a new Lottie player instance
  const player = container.querySelector('lottie-player');

  if (player) {
    player.load();

    // Render the animation in the container
    player.addEventListener('load', () => {
      player.play();
    });
  }
}
