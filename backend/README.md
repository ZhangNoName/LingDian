# backend（Python 服务）

统一 API 与业务逻辑。推荐 FastAPI + Python 3.11+，详见 `docs/05-backend-python.md`。

## 本地开发（占位）

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -e ".[dev]"   # 待依赖完善后
# uvicorn lingdian.main:app --reload   # 待入口模块创建后
```

源码位于 `src/lingdian/`；配置与密钥使用 `.env`（勿提交），模板见后续 `.env.example`。
