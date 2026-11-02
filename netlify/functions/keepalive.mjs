// هر روز یک بار /api/health را صدا می‌زند تا دیتابیس رایگان سوپابیس متوقف نشود
const keepalive = async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!base) return;
  try {
    const res = await fetch(`${base}/api/health`);
    console.log("keepalive", res.status);
  } catch (e) {
    console.log("keepalive failed", String(e));
  }
};

export default keepalive;

export const config = { schedule: "@daily" };
