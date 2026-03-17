const fs = require('fs');
const path = require('path');

const fileToDelete = 'src/types/budgetKanban.ts';
const projectRoot = '/home/project';
const scriptPath = path.join(projectRoot, 'delete-budget-kanban-type.js');

const filePath = path.join(projectRoot, fileToDelete);
try {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Successfully deleted: ${filePath}`);
  } else {
    console.log(`File not found, skipping: ${filePath}`);
  }
} catch (err) {
  console.error(`Error deleting ${filePath}:`, err);
}

// Self-delete
try {
  fs.unlinkSync(scriptPath);
  console.log('Deletion script removed itself.');
} catch (err) {
  console.warn('Could not self-delete script:', err.message);
}
