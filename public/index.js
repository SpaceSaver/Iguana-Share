window.onload = () => {
  document.getElementById("upload").addEventListener("click", () => {
    const fileElem = document.getElementById("fileUpload");
    const selectedFile = fileElem.files[0];
    FileUpload(selectedFile);
  });
};
async function FileUpload(file) {
  const reader = file.stream().getReader();
  const total = file.size;
  const pbar = document.getElementById("uploadp");
  function updateProgress(progress) {
    if (progress) {
      const percentage = Math.round((progress * 100) / total);
      pbar.textContent = percentage + "%";
      pbar.value = percentage;
    }
  }
  function progressFinish() {
    pbar.value = 100;
    pbar.textContent = "100%";
  }
  function updateAvailableURL(text) {
    document.getElementById("download").href = `${(new URL(location.href)).origin}/download/${text}`;
    document.getElementById("download").textContent = `${(new URL(location.href)).origin}/download/${text}`;
    document.getElementById("download").style.display = "";
  }
  const uploadUrl = new URL("/upload", window.location.href);
  uploadUrl.searchParams.set("title", file.name);
  uploadUrl.searchParams.set("author", "guest");
  (await fetch(uploadUrl, {method: "POST"})).text().then(async id => {
    let nextrun = await reader.read(1000000);
    let thisrun = undefined;
    let progress = 0;
    let response = undefined;
    while (true) {
      thisrun = nextrun;
      nextrun = await reader.read(1000000);
      response = await fetch("/upload/" + id + (nextrun.done ? "?end=1" : ""), {
        body: thisrun.value,
        headers: {"Content-Type": "application/octet-stream"},
        method: "POST"
      });
      if (nextrun.done) {
        break;
      }
      progress += 1000000;
    }
    progressFinish();
    response.text().then(updateAvailableURL);
  })
}