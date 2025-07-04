class Task {
    constructor(id, text, priority, category, dueDate, notes, completed = false, dateAdded = new Date()) {
        this.id = id;
        this.text = text;
        this.priority = priority;
        this.category = category;
        this.dueDate = dueDate;
        this.notes = notes;
        this.completed = completed;
        this.dateAdded = dateAdded;
    }
}

class TaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.taskList = document.querySelector('.task-list');
        this.taskForm = document.querySelector('.task-form');
        this.taskInput = document.querySelector('.task-input');
        this.prioritySelect = document.querySelector('.priority-select');
        this.categorySelect = document.querySelector('.category-select');
        this.dueDateInput = document.querySelector('.due-date');
        this.taskCounter = document.querySelector('.counter-value');
        this.searchInput = document.querySelector('.search-input');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.sortSelect = document.querySelector('.sort-select');
        this.progressCircle = document.querySelector('.progress-circle');
        this.priorityStats = document.querySelectorAll('.priority-stat .progress-fill');
        this.modal = document.querySelector('.modal');
        this.modalForm = document.querySelector('.modal-form');
        this.modalText = document.querySelector('.modal-task-text');
        this.modalPriority = document.querySelector('.modal-priority');
        this.modalCategory = document.querySelector('.modal-category');
        this.modalDueDate = document.querySelector('.modal-due-date');
        this.modalNotes = document.querySelector('.modal-notes');
        this.currentTaskId = null;
        this.isDarkTheme = localStorage.getItem('theme') === 'dark';
        this.init();
    }

    init() {
        this.taskForm.addEventListener('submit', (e) => this.addTask(e));
        this.taskList.addEventListener('click', (e) => this.handleTaskClick(e));
        this.taskList.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.taskList.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.taskList.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.taskList.addEventListener('drop', (e) => this.handleDrop(e));
        this.searchInput.addEventListener('input', this.debounce(() => this.filterTasks(), 300));
        this.filterButtons.forEach(btn => btn.addEventListener('click', (e) => this.setFilter(e)));
        this.sortSelect.addEventListener('change', () => this.sortTasks());
        this.modalForm.addEventListener('submit', (e) => this.saveModal(e));
        document.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
        document.querySelector('.theme-btn').addEventListener('click', () => this.toggleTheme());
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        this.renderTasks();
        this.updateStats();
        this.initVoiceControl();
        this.initParticles();
        this.initIntersectionObserver();
        this.applyTheme();
    }

    addTask(e) {
        e.preventDefault();
        const text = this.taskInput.value.trim();
        if (!text) return;
        const priority = this.prioritySelect.value;
        const category = this.categorySelect.value;
        const dueDate = this.dueDateInput.value;
        const task = new Task(Date.now(), text, priority, category, dueDate, '');
        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
        this.taskInput.value = '';
        this.dueDateInput.value = '';
        this.animateTaskAddition(task);
        this.updateStats();
    }

    renderTasks() {
        const search = this.searchInput.value.toLowerCase();
        const filter = document.querySelector('.filter-btn.active').dataset.filter;
        let tasks = [...this.tasks];

        if (search) tasks = tasks.filter(t => t.text.toLowerCase().includes(search));
        if (filter === 'active') tasks = tasks.filter(t => !t.completed);
        if (filter === 'completed') tasks = tasks.filter(t => t.completed);

        const sort = this.sortSelect.value;
        if (sort === 'priority') {
            const priorityOrder = { high: 1, medium: 2, low: 3 };
            tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        } else if (sort === 'alphabetical') {
            tasks.sort((a, b) => a.text.localeCompare(b.text));
        } else {
            tasks.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
        }

        this.taskList.innerHTML = '';
        tasks.forEach(task => this.renderTask(task));
        this.updateCounter();
    }

    renderTask(task) {
        const li = document.createElement('li');
        li.classList.add('task-item');
        li.setAttribute('draggable', true);
        li.setAttribute('data-id', task.id);
        li.setAttribute('tabindex', 0);
        if (task.completed) li.classList.add('completed');
        li.innerHTML = `
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
            <span class="priority-indicator ${task.priority}"></span>
            <span class="category-indicator ${task.category}"></span>
            <span class="task-text">${task.text}</span>
            <span class="due-date-text">${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ''}</span>
            <div class="task-actions">
                <button class="edit-btn">✏️</button>
                <button class="delete-btn">🗑️</button>
            </div>
        `;
        this.taskList.appendChild(li);
    }

    handleTaskClick(e) {
        const target = e.target;
        const li = target.closest('.task-item');
        if (!li) return;
        const id = parseInt(li.dataset.id);
        if (target.classList.contains('task-checkbox')) {
            this.toggleComplete(id, li);
        } else if (target.classList.contains('edit-btn')) {
            this.openModal(id);
        } else if (target.classList.contains('delete-btn')) {
            this.deleteTask(id, li);
        }
        this.addRippleEffect(e);
    }

    handleDoubleClick(e) {
        const li = e.target.closest('.task-item');
        if (!li || !e.target.classList.contains('task-text')) return;
        const id = parseInt(li.dataset.id);
        const task = this.tasks.find(t => t.id === id);
        const newText = prompt('Edit task:', task.text);
        if (newText !== null && newText.trim()) {
            task.text = newText.trim();
            this.saveTasks();
            this.renderTasks();
        }
    }

    toggleComplete(id, li) {
        const task = this.tasks.find(t => t.id === id);
        task.completed = !task.completed;
        li.classList.toggle('completed');
        this.saveTasks();
        this.renderTasks();
        this.updateStats();
        if (this.tasks.every(t => t.completed && t.completed)) this.triggerConfetti();
        this.animateTaskCompletion(li);
    }

    openModal(id) {
        const task = this.tasks.find(t => t.id === id);
        this.currentTaskId = id;
        this.modalText.value = task.text;
        this.modalPriority.value = task.priority;
        this.modalCategory.value = task.category;
        this.modalDueDate.value = task.dueDate || '';
        this.modalNotes.value = task.notes || '';
        this.modal.classList.add('active');
        this.modalText.focus();
    }

    saveModal(e) {
        e.preventDefault();
        const task = this.tasks.find(t => t.id === this.currentTaskId);
        task.text = this.modalText.value.trim();
        task.priority = this.modalPriority.value;
        task.category = this.modalCategory.value;
        task.dueDate = this.modalDueDate.value;
        task.notes = this.modalNotes.value.trim();
        this.saveTasks();
        this.renderTasks();
        this.closeModal();
        this.updateStats();
    }

    closeModal() {
        this.modal.classList.remove('active');
        this.currentTaskId = null;
    }

    deleteTask(id, li) {
        this.animateTaskDeletion(li, () => {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.saveTasks();
            this.renderTasks();
            this.updateStats();
        });
    }

    saveTasks() {
        requestIdleCallback(() => {
            localStorage.setItem('tasks', JSON.stringify(this.tasks));
        });
    }

    updateCounter() {
        const count = this.tasks.filter(t => !t.completed).length;
        this.taskCounter.textContent = count;
        this.taskCounter.parentElement.classList.add('active');
        setTimeout(() => this.taskCounter.parentElement.classList.remove('active'), 500);
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const percentage = total ? Math.round((completed / total) * 100) : 0;
        this.progressCircle.dataset.progress = percentage;
        this.progressCircle.querySelector('.progress-bar').style.strokeDashoffset = 283 - (283 * percentage) / 100;
        this.progressCircle.querySelector('.progress-value').textContent = `${percentage}%`;

        const priorities = { low: 0, medium: 0, high: 0 };
        this.tasks.forEach(t => priorities[t.priority]++);
        this.priorityStats.forEach(stat => {
            const priority = stat.parentElement.classList[1];
            const count = priorities[priority];
            const width = total ? (count / total) * 100 : 0;
            stat.style.width = `${width}%`;
        });
    }

    setFilter(e) {
        this.filterButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.renderTasks();
    }

    sortTasks() {
        this.renderTasks();
    }

    filterTasks() {
        this.renderTasks();
    }


    debounce(func, wait) {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }

    handleDragStart(e) {
        const li = e.target.closest('.task-item');
        if (!li) return;
        e.dataTransfer.setData('text/plain', li.dataset.id);
        li.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDrop(e) {
        e.preventDefault();
        const id = parseInt(e.dataTransfer.getData('text/plain'));
        const draggedLi = this.taskList.querySelector(`[data-id="${id}"]`);
        const targetLi = e.target.closest('.task-item');
        if (!targetLi || draggedLi === targetLi) return;

        const draggedIndex = this.tasks.findIndex(t => t.id === id);
        const targetIndex = this.tasks.findIndex(t => t.id === parseInt(targetLi.dataset.id));
        const [draggedTask] = this.tasks.splice(draggedIndex, 1);
        this.tasks.splice(targetIndex, 0, draggedTask);
        this.saveTasks();
        this.renderTasks();
        this.animateTaskReorder();
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.classList.toggle('dark', this.isDarkTheme);
    }

    handleKeyboard(e) {
        const items = [...this.taskList.querySelectorAll('.task-item')];
        const active = document.activeElement;
        const index = items.indexOf(active.closest('.task-item'));
        if (e.key === 'ArrowDown' && index < items.length - 1) {
            items[index + 1].focus();
        } else if (e.key === 'ArrowUp' && index > 0) {
            items[index - 1].focus();
        } else if (e.key === 'Enter' && active.closest('.task-item')) {
            this.openModal(parseInt(active.closest('.task-item').dataset.id));
        }
    }

    animateTaskAddition(task) {
        const li = this.taskList.querySelector(`[data-id="${task.id}"]`);
        li.style.transform = 'scale(0)';
        li.animate([
            { transform: 'scale(0) rotateX(-90deg)', opacity: 0 },
            { transform: 'scale(1.1) rotateX(10deg)', opacity: 1 },
            { transform: 'scale(1) rotateX(0deg)' }
        ], {
            duration: 600,
            easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
        });
    }

    animateTaskCompletion(li) {
        li.animate([
            { transform: 'rotateY(0deg) rotateX(0deg)' },
            { transform: 'rotateY(180deg) rotateX(10deg)', scale: 0.95 }
        ], {
            duration: 500,
            easing: 'ease-in-out'
        });
    }

    animateTaskDeletion(li, callback) {
        const rect = li.getBoundingClientRect();
        const priority = li.querySelector('.priority-indicator').classList[1];
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            particle.style.background = `var(--${priority}-priority)`;
            particle.style.left = `${rect.left + Math.random() * rect.width}px`;
            particle.style.top = `${rect.top + Math.random() * rect.height}px`;
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
        li.style.opacity = '0';
        setTimeout(callback, 500);
    }

    animateTaskReorder() {
        const items = this.taskList.querySelectorAll('.task-item');
        items.forEach((item, index) => {
            item.animate([
                { transform: 'translateY(20px)', opacity: 0.5 },
                { transform: 'translateY(0)', opacity: 1 }
            ], {
                duration: 300,
                delay: index * 50,
                easing: 'ease-out'
            });
        });
    }

    addRippleEffect(e) {
        const target = e.target.closest('button, .task-checkbox');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        const diameter = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${diameter}px`;
        ripple.style.left = `${e.clientX - rect.left - diameter / 2}px`;
        ripple.style.top = `${e.clientY - rect.top - diameter / 2}px`;
        target.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    triggerConfetti() {
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            confetti.style.left = `${Math.random() * 100}vw`;
            confetti.style.background = ['#f44336', '#4caf50', '#ff9800'][Math.floor(Math.random() * 3)];
            confetti.style.animationDelay = `${Math.random() * 2}s`;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 2000);
        }
    }

    initVoiceControl() {
        const voiceBtn = document.querySelector('.voice-btn');
        if (!('webkitSpeechRecognition' in window)) {
            voiceBtn.style.display = 'none';
            return;
        }
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        voiceBtn.addEventListener('click', () => {
            recognition.start();
            voiceBtn.style.background = 'rgba(255, 0, 0, 0.3)';
        });

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            this.taskInput.value = text;
            this.taskForm.dispatchEvent(new Event('submit'));
            voiceBtn.style.background = '';
        };

        recognition.onend = () => {
            voiceBtn.style.background = '';
        };
    }

    initParticles() {
        const canvas = document.querySelector('.particle-bg');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        for (let i = 0; i < (window.innerWidth < 600 ? 30 : 50); i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 2 + 1,
                vx: Math.random() * 2 - 1,
                vy: Math.random() * 2 - 1,
                color: ['#f44336', '#4caf50', '#ff9800'][Math.floor(Math.random() * 3)]
            });
        }

        const animateParticles = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            });
            requestAnimationFrame(animateParticles);
        };

        canvas.addEventListener('mousemove', (e) => {
            particles.forEach(p => {
                const dx = e.clientX - p.x;
                const dy = e.clientY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    p.vx += dx * 0.01;
                    p.vy += dy * 0.01;
                }
            });
        });

        canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            particles.forEach(p => {
                const dx = touch.clientX - p.x;
                const dy = touch.clientY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    p.vx += dx * 0.01;
                    p.vy += dy * 0.01;
                }
            });
        });

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });

        animateParticles();
    }

    initIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.transform = 'translateZ(40px)';
                } else {
                    entry.target.style.transform = 'translateZ(0px)';
                }
            });
        }, { threshold: 0.5 });

        this.taskList.querySelectorAll('.task-item').forEach(item => observer.observe(item));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
});
