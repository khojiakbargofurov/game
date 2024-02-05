const btn = document.querySelector('.btn');
const title = document.querySelector('.title');
const numbersContainer = document.querySelector('.numbers');
let selectedNumbers = [];

btn.addEventListener('click', () => {
  title.style.display = 'none';
  const numContainer = document.createElement('div');
  numContainer.className = "grid grid-cols-4 md:grid-cols-4 gap-4 border border-white rounded-lg text-sm px-5 py-2.5 mx-auto"
  numContainer.classList.add('btns');

  for (let i = 1; i <= 10; i++) {
    const button = document.createElement('button');
    button.className = "btn text-blue-700 hover:text-white border border-white hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 text-white";
    button.classList.add('number');
    button.textContent = i;
    button.addEventListener('click', handleNumberClick);
    numContainer.appendChild(button);
  }
  for (let i = 10; i >= 1; i--) {
    const button = document.createElement('button');
    button.className = "btn numbtn text-blue-700 hover:text-white border border-white hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2 dark:border-blue-500 dark:text-blue-500 dark:hover:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-800 text-white";
    button.classList.add('number');
    button.textContent = i;
    button.addEventListener('click', handleNumberClick);
    numContainer.appendChild(button);
  }

  numbersContainer.appendChild(numContainer);
});

function handleNumberClick(event) {
  const clickedButton = event.target;
  const clickedNumber = clickedButton.textContent;

  selectedNumbers.push(clickedNumber);

  if (selectedNumbers.length === 2) {
    if (selectedNumbers[0] === selectedNumbers[1]) {
      hideButtons(selectedNumbers[0]);
    } else {
      alert("qayta urinib ko'ring");
    }
    selectedNumbers = [];
  }
}

function hideButtons(numberToHide) {
  const buttonsToHide = document.querySelectorAll('.number');
  buttonsToHide.forEach(button => {
    if (button.textContent === numberToHide) {
      button.style.visibility = 'hidden';
    }
  });
}
