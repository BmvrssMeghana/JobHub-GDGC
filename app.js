const API = "https://jsonfakery.com/jobs";
const LS_JOBS = "jobhub_jobs";
const LS_APPS = "jobhub_applications";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

let state = {
  jobs: [],
  filtered: [],
  selectedId: null,
  role: localStorage.getItem("jobhub_role") || "Job Seeker",
  query: "",
  type: "All",
  sort: "newest",
  apps: JSON.parse(localStorage.getItem(LS_APPS) || "{}"),
};

const roleSelect = document.getElementById("roleSelect");
const addJobBtn = document.getElementById("addJobBtn");
const jobsList = document.getElementById("jobsList");
const detailsArea = document.getElementById("detailsArea");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const sortSelect = document.getElementById("sortSelect");
const resultsText = document.getElementById("resultsText");
const roleLabel = document.getElementById("roleLabel");
const recruiterButtons = document.getElementById("recruiterButtons");

const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const jobTitle = document.getElementById("jobTitle");
const jobCompany = document.getElementById("jobCompany");
const jobLocation = document.getElementById("jobLocation");
const jobType = document.getElementById("jobType");
const jobSalary = document.getElementById("jobSalary");
const jobTags = document.getElementById("jobTags");
const jobDescription = document.getElementById("jobDescription");
const cancelModal = document.getElementById("cancelModal");
const saveModal = document.getElementById("saveModal");

let editingId = null;

roleSelect.value = state.role;
roleLabel.innerText = `Role: ${state.role}`;
toggleRecruiterUI();

roleSelect.addEventListener("change", (e) => {
  state.role = e.target.value;
  localStorage.setItem("jobhub_role", state.role);
  roleLabel.innerText = `Role: ${state.role}`;
  toggleRecruiterUI();
  renderDetails();
});

searchInput.addEventListener("input", (e) => {
  state.query = e.target.value.trim();
  applyFilters();
});
typeFilter.addEventListener("change", (e) => {
  state.type = e.target.value;
  applyFilters();
});
sortSelect.addEventListener("change", (e) => {
  state.sort = e.target.value;
  applyFilters();
});
addJobBtn.addEventListener("click", () => openModalForAdd());

cancelModal.addEventListener("click", closeModal);
saveModal.addEventListener("click", saveModalJob);

function loadJobs() {
  const stored = localStorage.getItem(LS_JOBS);
  if (stored) {
    try {
      state.jobs = JSON.parse(stored);
      applyFilters();
      return;
    } catch (e) {}
  }

  fetch(API)
    .then((r) => r.json())
    .then((list) => {
      const norm = list.map((j) => ({
        id: j.id || uid(),
        title: j.title || j.role || "Untitled",
        company: (j.company && j.company.name) || j.company || "Company",
        location: j.location || "Remote",
        type: j.type || j.jobType || "Full Time",
        salary: j.salary || j.compensation || "",
        description: j.description || j.summary || "",
        tags: j.tags || (j.skills ? j.skills.slice(0, 4) : []),
        datePosted: j.datePosted || new Date().toISOString(),
      }));
      state.jobs = norm;
      localStorage.setItem(LS_JOBS, JSON.stringify(state.jobs));
      applyFilters();
    })
    .catch((err) => {
      console.error("Failed to fetch jobs", err);
      state.jobs = [];
      applyFilters();
    });
}

function applyFilters() {
  const q = state.query.toLowerCase();
  state.filtered = state.jobs
    .filter((j) => {
      if (
        state.type !== "All" &&
        j.type.toLowerCase() !== state.type.toLowerCase()
      )
        return false;
      if (!q) return true;
      return (
        (j.title || "").toLowerCase().includes(q) ||
        (j.company || "").toLowerCase().includes(q) ||
        (j.tags || []).join(" ").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const da = new Date(a.datePosted).getTime();
      const db = new Date(b.datePosted).getTime();
      return state.sort === "newest" ? db - da : da - db;
    });

  resultsText.innerText = `Latest Job Openings — ${state.filtered.length} jobs found`;
  renderList();
  if (!state.selectedId && state.filtered.length)
    state.selectedId = state.filtered[0].id;
  renderDetails();
}

function renderList() {
  jobsList.innerHTML = "";
  if (state.filtered.length === 0) {
    jobsList.innerHTML = `<div class="card">No jobs found.</div>`;
    return;
  }
  state.filtered.forEach((job) => {
    const div = document.createElement("div");
    div.className = "jobCard";
    if (state.selectedId === job.id)
      div.style.border = "2px solid rgba(37,99,235,0.12)";
    div.innerHTML = `
      <div class="title">${escapeHtml(job.title)}</div>
      <div class="meta">${escapeHtml(job.company)} • ${escapeHtml(
      job.location
    )}</div>
      <div class="badges">${(job.tags || [])
        .slice(0, 4)
        .map((t) => `<span class="badge">${escapeHtml(t)}</span>`)
        .join("")}</div>
      <div style="margin-top:8px">
        <button class="small-btn" data-action="view" data-id="${
          job.id
        }">View / Apply</button>
        ${
          state.role === "Recruiter"
            ? `<button class="small-btn" data-action="edit" data-id="${job.id}">Edit</button>
        <button class="small-btn" data-action="delete" data-id="${job.id}">Delete</button>`
            : ""
        }
      </div>
    `;
    div.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const id = b.dataset.id;
        const action = b.dataset.action;
        if (action === "view") {
          state.selectedId = id;
          renderDetails();
        }
        if (action === "edit") {
          openModalForEdit(id);
        }
        if (action === "delete") {
          deleteJob(id);
        }
      });
    });

    div.addEventListener("click", () => {
      state.selectedId = job.id;
      renderDetails();
      renderList();
    });
    jobsList.appendChild(div);
  });
}

function renderDetails() {
  const job = state.jobs.find((j) => j.id === state.selectedId);
  if (!job) {
    detailsArea.innerHTML = `<p>Select a job to view details.</p>`;
    return;
  }
  const applied = state.apps[job.id] || [];
  let html = `
    <div class="details-title">${escapeHtml(job.title)}</div>
    <div class="details-meta">${escapeHtml(job.company)} • ${escapeHtml(
    job.location
  )}</div>
    <div style="margin-bottom:12px">${escapeHtml(
      job.description || "No description provided."
    )}</div>
    <div style="margin-bottom:8px"><strong>Tags:</strong> ${(
      job.tags || []
    ).join(", ")}</div>
    <div style="margin-bottom:8px"><strong>Salary:</strong> ${escapeHtml(
      job.salary
    )}</div>
    <div style="margin-bottom:14px"><strong>Posted:</strong> ${new Date(
      job.datePosted
    ).toLocaleString()}</div>
  `;

  if (state.role === "Job Seeker") {
    html += `
      <div><h4>Apply for this position</h4>
        <form id="applyForm" class="apply-form">
          <input id="appName" placeholder="Your name" />
          <input id="appEmail" placeholder="Your email" />
          <button id="submitApp" class="primary" type="submit">Apply for this Position</button>
        </form>
      </div>
    `;
  } else {
    html += `
      <div>
        <button class="primary" id="editFromDetail">Edit</button>
        <button id="deleteFromDetail" class="small-btn">Delete</button>
        <div style="margin-top:14px"><strong>Applications (${
          applied.length
        }):</strong>
          <ul>${applied
            .map(
              (a) =>
                `<li>${escapeHtml(a.name)} — ${escapeHtml(a.email)} (${new Date(
                  a.date
                ).toLocaleString()})</li>`
            )
            .join("")}</ul>
        </div>
      </div>
    `;
  }

  detailsArea.innerHTML = html;

  // attach handlers
  if (state.role === "Job Seeker") {
    const form = document.getElementById("applyForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("appName").value.trim();
      const email = document.getElementById("appEmail").value.trim();
      if (!name || !email) {
        alert("Name and email required");
        return;
      }
      submitApplication(job.id, { name, email });
      form.reset();
      alert("Application submitted!");
      renderDetails();
    });
  } else {
    document
      .getElementById("editFromDetail")
      .addEventListener("click", () => openModalForEdit(job.id));
    document
      .getElementById("deleteFromDetail")
      .addEventListener("click", () => deleteJob(job.id));
  }
}

function openModalForAdd() {
  editingId = null;
  modalTitle.innerText = "Add Job";
  jobTitle.value = "";
  jobCompany.value = "";
  jobLocation.value = "";
  jobType.value = "Full Time";
  jobSalary.value = "";
  jobTags.value = "";
  jobDescription.value = "";
  modalOverlay.classList.remove("hidden");
}

function openModalForEdit(id) {
  const job = state.jobs.find((j) => j.id === id);
  if (!job) return alert("Job not found");
  editingId = id;
  modalTitle.innerText = "Edit Job";
  jobTitle.value = job.title || "";
  jobCompany.value = job.company || "";
  jobLocation.value = job.location || "";
  jobType.value = job.type || "";
  jobSalary.value = job.salary || "";
  jobTags.value = (job.tags || []).join(", ");
  jobDescription.value = job.description || "";
  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  editingId = null;
}

function saveModalJob() {
  const payload = {
    id: editingId || uid(),
    title: jobTitle.value.trim(),
    company: jobCompany.value.trim(),
    location: jobLocation.value.trim() || "Remote",
    type: jobType.value.trim() || "Full Time",
    salary: jobSalary.value.trim(),
    tags: jobTags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    description: jobDescription.value.trim(),
    datePosted: editingId
      ? state.jobs.find((j) => j.id === editingId).datePosted
      : new Date().toISOString(),
  };
  if (!payload.title || !payload.company)
    return alert("Title and Company required");

  if (editingId) {
    state.jobs = state.jobs.map((j) => (j.id === editingId ? payload : j));
  } else {
    state.jobs.unshift(payload);
  }
  localStorage.setItem(LS_JOBS, JSON.stringify(state.jobs));
  closeModal();
  applyFilters();
}

function deleteJob(id) {
  if (!confirm("Delete this job?")) return;
  state.jobs = state.jobs.filter((j) => j.id !== id);
  localStorage.setItem(LS_JOBS, JSON.stringify(state.jobs));
  if (state.selectedId === id) state.selectedId = null;
  applyFilters();
}

function submitApplication(jobId, applicant) {
  const cur = state.apps[jobId] || [];
  const updated = [...cur, { ...applicant, date: new Date().toISOString() }];
  state.apps[jobId] = updated;
  localStorage.setItem(LS_APPS, JSON.stringify(state.apps));
}

function toggleRecruiterUI() {
  if (state.role === "Recruiter") {
    recruiterButtons.style.display = "block";
  } else {
    recruiterButtons.style.display = "none";
  }
  renderList();
  renderDetails();
}

function escapeHtml(str) {
  if (!str && str !== 0) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

loadJobs();
