import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("gefor.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    cpf TEXT NOT NULL UNIQUE,
    areaFormacao TEXT NOT NULL,
    nivelInstrucao TEXT NOT NULL,
    funcao TEXT NOT NULL,
    municipio TEXT NOT NULL,
    gre TEXT NOT NULL,
    unidadeTrabalho TEXT NOT NULL,
    inep TEXT,
    ipAddress TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Garantir que a tabela staff tenha a estrutura correta
db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'employee',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabela de Configurações do Sistema
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Migração manual: Adicionar coluna password se não existir (caso a tabela já existisse)
try {
  db.prepare("ALTER TABLE staff ADD COLUMN password TEXT NOT NULL DEFAULT ''").run();
} catch (e) {
  // Coluna já existe, ignorar erro
}

// Resetar/Garantir usuário admin padrão
const adminEmail = 'admin@gefor.pi.gov.br';
const hashedPassword = bcrypt.hashSync('admin123', 10);
const existingAdmin = db.prepare("SELECT id FROM staff WHERE email = ?").get(adminEmail);

if (!existingAdmin) {
  db.prepare("INSERT INTO staff (email, name, password, role) VALUES (?, ?, ?, ?)").run(adminEmail, 'Administrador', hashedPassword, 'admin');
} else {
  // Atualiza a senha do admin existente para garantir que admin123 funcione
  db.prepare("UPDATE staff SET password = ?, role = 'admin' WHERE email = ?").run(hashedPassword, adminEmail);
}

// Google Apps Script Configuration
async function getAppsScriptUrl() {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'GOOGLE_APPS_SCRIPT_URL'").get() as { value: string } | undefined;
  return setting?.value || process.env.GOOGLE_APPS_SCRIPT_URL;
}

async function syncWithGoogle(data: any, action: "validate" | "register") {
  try {
    const url = await getAppsScriptUrl();
    if (!url) {
      console.error("ERRO: URL do Google Apps Script não configurada.");
      return { status: "error", message: "A URL do Google Apps Script não foi configurada nas Configurações do Dashboard." };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, action })
    });

    const result = await response.json();
    console.log(`Apps Script Response (${action}):`, result);
    return result;
  } catch (error) {
    console.error("Erro ao comunicar com Google Apps Script:", error);
    return { status: "error", message: "Falha na comunicação com o banco de dados principal (Google Sheets)." };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true); // Para capturar IP real atrás de proxy
  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'gefor-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: 'none'
  }));

  // Auth Routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.prepare("SELECT * FROM staff WHERE email = ?").get(email) as any;
      
      if (user && bcrypt.compareSync(password, user.password)) {
        req.session!.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
        res.json({ status: "success", user: req.session!.user });
      } else {
        res.status(401).json({ status: "error", message: "E-mail ou senha incorretos." });
      }
    } catch (error) {
      res.status(500).json({ status: "error", message: "Erro no servidor." });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session?.user || null });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ status: "success" });
  });

  app.get("/api/stats", (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ status: "error", message: "Não autorizado." });
    }

    try {
      const total = db.prepare("SELECT count(*) as count FROM registrations").get() as { count: number };
      const porFuncao = db.prepare("SELECT funcao as name, count(*) as value FROM registrations GROUP BY funcao").all();
      const porNivel = db.prepare("SELECT nivelInstrucao as name, count(*) as value FROM registrations GROUP BY nivelInstrucao").all();
      const porMunicipio = db.prepare("SELECT municipio as name, count(*) as value FROM registrations GROUP BY municipio").all();

      const stats = {
        total: total.count,
        porFuncao: Object.fromEntries(porFuncao.map((r: any) => [r.name, r.value])),
        porNivel: Object.fromEntries(porNivel.map((r: any) => [r.name, r.value])),
        porMunicipio: Object.fromEntries(porMunicipio.map((r: any) => [r.name, r.value]))
      };

      res.json({ status: "success", data: stats });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Erro ao buscar estatísticas." });
    }
  });

  app.get("/api/staff", (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ status: "error", message: "Acesso negado." });
    }
    const staff = db.prepare("SELECT id, email, name, role, createdAt FROM staff ORDER BY createdAt DESC").all();
    res.json({ status: "success", data: staff });
  });

  app.post("/api/staff", (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ status: "error", message: "Acesso negado." });
    }
    const { email, name, password, role } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare("INSERT INTO staff (email, name, password, role) VALUES (?, ?, ?, ?)").run(email, name, hashedPassword, role || 'employee');
      res.json({ status: "success" });
    } catch (error) {
      res.status(400).json({ status: "error", message: "E-mail já cadastrado ou dados inválidos." });
    }
  });

  app.delete("/api/staff/:id", (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ status: "error", message: "Acesso negado." });
    }
    const { id } = req.params;
    db.prepare("DELETE FROM staff WHERE id = ?").run(id);
    res.json({ status: "success" });
  });

  // Settings Routes
  app.get("/api/settings", (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ status: "error", message: "Acesso negado." });
    }
    const url = db.prepare("SELECT value FROM settings WHERE key = 'GOOGLE_APPS_SCRIPT_URL'").get() as { value: string } | undefined;
    res.json({ url: url?.value || "" });
  });

  app.post("/api/settings", (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ status: "error", message: "Acesso negado." });
    }
    const { url } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('GOOGLE_APPS_SCRIPT_URL', ?)").run(url);
    res.json({ status: "success" });
  });

  // API Routes
  app.post("/api/validate", async (req, res) => {
    const { email, cpf, mobile } = req.body;
    try {
      // 1. Check Google Apps Script (Primary Source of Truth)
      const googleResult = await syncWithGoogle({ email, cpf, mobile }, "validate");
      
      // Se o Google diz que está OK (não existe na planilha), 
      // mas existe no banco local, limpamos o local para sincronizar.
      if (googleResult && googleResult.status === "success") {
        db.prepare("DELETE FROM registrations WHERE email = ? OR cpf = ?").run(email, cpf);
      }

      if (googleResult && googleResult.status === "error") {
        return res.status(400).json({ status: "error", message: googleResult.message });
      }

      // 2. Local Check (Backup - Só bloqueia se o Google falhar ou não estiver configurado)
      const localExisting = db.prepare(`
        SELECT 
          (SELECT 1 FROM registrations WHERE email = ?) as emailExists,
          (SELECT 1 FROM registrations WHERE cpf = ?) as cpfExists
      `).get(email, cpf) as { emailExists: number, cpfExists: number };

      if (localExisting.emailExists) {
        return res.status(400).json({ status: "error", message: "Este e-mail já consta no sistema local." });
      }
      if (localExisting.cpfExists) {
        return res.status(400).json({ status: "error", message: "Este CPF já consta no sistema local." });
      }

      res.json({ status: "success" });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Erro ao validar dados." });
    }
  });

  app.post("/api/register", async (req, res) => {
    const data = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '0.0.0.0';

    try {
      // 1. Enviar para o MOTOR GEFOR v25.1 (Planilha + Brevo Quad-Motor)
      const googleResult = await syncWithGoogle({ ...data, ipAddress }, "register");
      
      if (!googleResult || googleResult.status === "error") {
        return res.status(400).json({ 
          status: "error", 
          message: googleResult?.message || "O motor de cadastro não respondeu. Tente novamente." 
        });
      }

      console.log(`✅ Inscrição confirmada via ${googleResult.motor || 'Motor Desconhecido'} - Protocolo: ${googleResult.protocolo || 'N/A'}`);

      // 2. Se a planilha aceitou, salvamos no SQLite local como BACKUP
      const stmt = db.prepare(`
        INSERT INTO registrations (
          name, mobile, email, cpf, areaFormacao, nivelInstrucao, 
          funcao, municipio, gre, unidadeTrabalho, inep, ipAddress
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        data.name, data.mobile, data.email, data.cpf, data.areaFormacao, data.nivelInstrucao,
        data.funcao, data.municipio, data.gre, data.unidadeTrabalho, data.inep || null, ipAddress
      );

      res.json({ 
        status: "success", 
        message: "Inscrição realizada com sucesso!",
        protocolo: googleResult.protocolo,
        motor: googleResult.motor
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ status: "error", message: "Erro ao processar backup do cadastro." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
