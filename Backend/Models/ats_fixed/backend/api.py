"""
ATS Resume Scorer V4.0 - REST API with Job Dataset Integration
Flask backend with job selection from Peak Accuracy dataset

NEW FEATURES:
- Load jobs from Excel dataset (1,197 jobs)
- Filter jobs by category, experience level
- Search jobs by keyword
- Auto-populate job description from selected job
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
from datetime import datetime
from typing import Dict, List
import tempfile
import shutil
import time
import pandas as pd
import re
from pathlib import Path
from dotenv import load_dotenv
# Try to import requests; fall back to urllib if not installed
try:
    import requests
    HAVE_REQUESTS = True
except Exception:
    import urllib.request as _urllib_request
    import urllib.error as _urllib_error
    HAVE_REQUESTS = False
from ats_ai_model_v4 import ATSScorerV4, ATSScore

# Load the workspace-level .env (walk up from this file path).
for _parent in Path(__file__).resolve().parents:
    _env_file = _parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file, override=False)
        break


def _to_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


ATS_API_URL = (os.getenv("ATS_API_URL") or "http://localhost:5000").rstrip("/")
ATS_BIND_HOST = os.getenv("ATS_BIND_HOST") or os.getenv("ATS_HOST") or "0.0.0.0"
ATS_BIND_PORT = _to_int(os.getenv("ATS_PORT"), 5000)
RESUME_BUILDER_API_URL = (os.getenv("VITE_RESUME_BUILDER_API_URL") or "http://localhost:8090").rstrip("/")

app = Flask(__name__)
# Allow common local frontend ports and optional env-based origin.
frontend_origin = os.getenv("VITE_FRONTEND_URL") or os.getenv("FRONTEND_URL")
allowed_origins = [origin for origin in [frontend_origin, "http://localhost:3000", "http://${FRONTEND_HOST}:${FRONTEND_PORT}"] if origin and "${" not in origin]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp()
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx', 'png', 'jpg', 'jpeg'}

# Initialize AI Model
scorer = ATSScorerV4()

# In-memory storage for analysis history
analysis_history = []

# Load Job Dataset
DATASET_PATH = os.path.join(os.path.dirname(__file__), 'Peak_Accuracy_ATS_Dataset.xlsx')
jobs_df = None
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 30
MAX_HISTORY_RECORDS = 200
rate_limit_log: Dict[str, List[float]] = {}

def load_job_dataset():
    """Load job dataset from Excel file"""
    global jobs_df
    try:
        jobs_df = pd.read_excel(DATASET_PATH)
        print(f"Loaded {len(jobs_df)} jobs from dataset")
        print(f"   Categories: {jobs_df['Category'].nunique()}")
        print(f"   Experience Levels: {jobs_df['Experience Level'].nunique()}")
        return True
    except Exception as e:
        print(f"Error loading dataset: {e}")
        return False

# Load dataset on startup
load_job_dataset()


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _json_error(message: str, status: int = 400, details: Dict = None):
    payload = {'error': message}
    if details:
        payload['details'] = details
    return jsonify(payload), status


def _safe_remove(filepath: str):
    try:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
    except OSError:
        pass


def _safe_rmtree(directory: str):
    try:
        if directory and os.path.exists(directory):
            shutil.rmtree(directory)
    except OSError:
        pass


def _save_uploaded_file(file_storage):
    temp_dir = tempfile.mkdtemp()
    original_name = file_storage.filename or 'resume'
    filename = secure_filename(original_name) or 'resume'
    file_path = os.path.join(temp_dir, filename)
    file_storage.save(file_path)

    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)

    return temp_dir, file_path, filename


def _is_rate_limited(bucket: str) -> bool:
    client_key = f"{request.remote_addr or 'local'}:{bucket}"
    now = time.time()
    recent = [ts for ts in rate_limit_log.get(client_key, []) if now - ts < RATE_LIMIT_WINDOW_SECONDS]
    if len(recent) >= RATE_LIMIT_MAX_REQUESTS:
        rate_limit_log[client_key] = recent
        return True
    recent.append(now)
    rate_limit_log[client_key] = recent
    return False


def _validate_resume_text(resume_text: str):
    if not isinstance(resume_text, str) or not resume_text.strip():
        return "No resume text provided"
    if len(resume_text.strip()) < 50:
        return "Resume text too short. Please provide at least 50 characters."
    return None


def _build_job_description_from_row(job_data) -> str:
    return f"""
Job Title: {job_data['Job Title']}

Description:
{job_data['Description']}

Required IT Skills:
{job_data['IT Skills']}

Required Soft Skills:
{job_data['Soft Skills']}

Education Requirements:
{job_data['Education']}

Experience Requirements:
{job_data['Experience']}

Category: {job_data['Category']}
Experience Level: {job_data['Experience Level']}
"""


def _resolve_job_context(job_id_value, manual_job_description):
    job_description = None
    job_info = None
    resolved_job_id = None

    if job_id_value and jobs_df is not None:
        try:
            resolved_job_id = int(job_id_value)
            job = jobs_df[jobs_df['ID'] == resolved_job_id]
            if len(job) > 0:
                job_data = job.iloc[0]
                job_description = _build_job_description_from_row(job_data)
                job_info = {
                    'id': int(job_data['ID']),
                    'title': job_data['Job Title'],
                    'category': job_data['Category'],
                    'experience_level': job_data['Experience Level'],
                    'it_skills': job_data['IT Skills'],
                    'soft_skills': job_data['Soft Skills']
                }
        except (ValueError, KeyError) as e:
            print(f"Error processing job_id: {e}")

    return job_description or manual_job_description, job_info, resolved_job_id


def _append_analysis_history(record: Dict):
    analysis_history.append(record)
    if len(analysis_history) > MAX_HISTORY_RECORDS:
        del analysis_history[:-MAX_HISTORY_RECORDS]


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '4.0-DATASET',
        'timestamp': datetime.now().isoformat(),
        'features': {
            'bert': scorer.bert_embedder.available if scorer.bert_embedder else False,
            'language_detection': True,
            'visual_analysis': True,
            'job_matching': True,
            'scoring_transparency': True,
            'rate_limiting': True,
            'job_dataset': jobs_df is not None,
            'total_jobs': len(jobs_df) if jobs_df is not None else 0
        },
        'rate_limit': {
            'window_seconds': RATE_LIMIT_WINDOW_SECONDS,
            'max_requests': RATE_LIMIT_MAX_REQUESTS,
        },
        'dataset_info': {
            'loaded': jobs_df is not None,
            'total_jobs': len(jobs_df) if jobs_df is not None else 0,
            'categories': jobs_df['Category'].nunique() if jobs_df is not None else 0,
            'experience_levels': jobs_df['Experience Level'].nunique() if jobs_df is not None else 0
        }
    }), 200


@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    """
    Get list of jobs from dataset with optional filtering
    
    Query params:
        - category: Filter by category (optional)
        - experience_level: Filter by experience level (optional)
        - search: Search in job title and description (optional)
        - limit: Number of jobs to return (default: 100, max: 500)
    """
    
    if jobs_df is None:
        return jsonify({'error': 'Job dataset not loaded'}), 500
    
    try:
        # Start with all jobs
        filtered_df = jobs_df.copy()
        
        # Apply filters
        category = request.args.get('category')
        if category:
            filtered_df = filtered_df[filtered_df['Category'] == category]
        
        experience_level = request.args.get('experience_level')
        if experience_level:
            filtered_df = filtered_df[filtered_df['Experience Level'] == experience_level]
        
        search = request.args.get('search', '').strip()
        if search:
            search_lower = search.lower()
            filtered_df = filtered_df[
                filtered_df['Job Title'].str.lower().str.contains(search_lower, na=False) |
                filtered_df['Description'].str.lower().str.contains(search_lower, na=False) |
                filtered_df['Category'].str.lower().str.contains(search_lower, na=False)
            ]
        
        # Apply limit
        limit = request.args.get('limit', 100, type=int)
        limit = min(limit, 500)  # Max 500 jobs
        
        filtered_df = filtered_df.head(limit)
        
        # Convert to list of dicts
        jobs = filtered_df.to_dict('records')
        
        return jsonify({
            'success': True,
            'total': len(filtered_df),
            'total_in_dataset': len(jobs_df),
            'jobs': jobs
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error fetching jobs: {str(e)}'}), 500


@app.route('/api/jobs/<int:job_id>', methods=['GET'])
def get_job(job_id: int):
    """Get specific job by ID"""
    
    if jobs_df is None:
        return jsonify({'error': 'Job dataset not loaded'}), 500
    
    try:
        job = jobs_df[jobs_df['ID'] == job_id]
        
        if len(job) == 0:
            return jsonify({'error': 'Job not found'}), 404
        
        job_data = job.iloc[0].to_dict()
        
        return jsonify({
            'success': True,
            'job': job_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error fetching job: {str(e)}'}), 500


@app.route('/api/jobs/filters', methods=['GET'])
def get_job_filters():
    """Get available filter options from dataset"""
    
    if jobs_df is None:
        return jsonify({'error': 'Job dataset not loaded'}), 500
    
    try:
        return jsonify({
            'success': True,
            'categories': sorted(jobs_df['Category'].dropna().unique().tolist()),
            'experience_levels': sorted(jobs_df['Experience Level'].dropna().unique().tolist()),
            'sub_categories': sorted(jobs_df['Sub Category'].dropna().unique().tolist())
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error fetching filters: {str(e)}'}), 500


@app.route('/api/score', methods=['POST'])
def score_resume():
    """
    Score a resume with optional job description or job ID
    
    Request:
        - file: Resume file (PDF, TXT, DOCX, or image)
        - job_description: (optional) Job description text
        - job_id: (optional) Job ID from dataset
    
    Note: If job_id is provided, it takes precedence over job_description
    
    Response:
        - overall_score: Overall ATS score
        - category_scores: Breakdown by category
        - recommendations: List of improvement suggestions
        - job_match_score: Match score if job description provided
        - skills_gap: Missing skills if job description provided
        - scoring_breakdown: Transparency into scoring
        - job_info: Job details if job_id was used
    """
    
    temp_dir = None
    filepath = None
    try:
        if _is_rate_limited('score_file'):
            return _json_error('Rate limit exceeded. Please wait and try again.', 429)

        # Check if file is present
        if 'file' not in request.files:
            return _json_error('No file provided', 400)
        
        file = request.files['file']
        
        if file.filename == '':
            return _json_error('Empty filename', 400)
        
        if not allowed_file(file.filename):
            return _json_error(
                f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}',
                400,
            )
        
        # Save file temporarily
        temp_dir, filepath, filename = _save_uploaded_file(file)
        
        # Extract text from file
        resume_text = scorer.extract_text(filepath)
        
        validation_error = _validate_resume_text(resume_text)
        if validation_error:
            return _json_error(
                'Could not extract sufficient text from file. Please ensure the file contains readable text.',
                400,
                {'validation_error': validation_error},
            )
        
        # Get job description - either from job_id or manual input
        job_description, job_info, job_id = _resolve_job_context(
            request.form.get('job_id'),
            request.form.get('job_description', None),
        )
        
        # Score the resume
        result = scorer.score_resume(
            resume_text=resume_text,
            job_description=job_description,
            file_path=filepath
        )
        
        # Save to history
        analysis_record = {
            'id': len(analysis_history) + 1,
            'filename': filename,
            'timestamp': datetime.now().isoformat(),
            'score': result.overall_score,
            'has_job_match': job_description is not None,
            'job_id': job_id if job_id else None
        }
        _append_analysis_history(analysis_record)
        
        # Return results
        response_data = {
            'success': True,
            'analysis_id': analysis_record['id'],
            'overall_score': result.overall_score,
            'category_scores': result.category_scores,
            'recommendations': result.recommendations,
            'job_match_score': result.job_match_score,
            'skills_gap': result.skills_gap,
            'language': result.language,
            'visual_quality_score': result.visual_quality_score,
            'bert_semantic_score': result.bert_semantic_score,
            'version': result.version,
            'timestamp': analysis_record['timestamp'],
            'scoring_breakdown': result.scoring_breakdown
        }
        
        # Add job info if job was selected from dataset
        if job_info:
            response_data['job_info'] = job_info

        # Attempt to persist the resume + analysis to Java backend
        try:
            # Build a resume payload compatible with Resume entity
            def _extract_email(text: str):
                m = re.search(r'[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}', text)
                return m.group(0) if m else None

            def _extract_phone(text: str):
                m = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
                return m.group(0) if m else None

            # Try to get a name from the first non-empty line
            def _extract_name(text: str):
                for line in text.splitlines():
                    s = line.strip()
                    if s and len(s.split()) <= 4 and not re.search(r'@|\d', s):
                        return s
                return None

            resume_payload = {
                'USEREMAIL': request.form.get('user_email') or _extract_email(resume_text) or 'anonymous',
                'TARGETROLE': job_info['title'] if job_info else request.form.get('target_role') or (job_description and (job_description[:120])),
                'FULL_NAME': _extract_name(resume_text) or '',
                'EMAIL': _extract_email(resume_text) or '',
                'PHONE': _extract_phone(resume_text) or '',
                'SUMMARY': resume_text[:2000],
                'SKILLS': ', '.join(result.skills_gap) if result.skills_gap else (job_info.get('it_skills') if job_info else ''),
                'EXPERIENCE': '',
                'EDUCATION': '',
                'PROJECTS': '',
                'CERTIFICATIONS': '',
                'SOFT_SKILLS': job_info.get('soft_skills') if job_info else '',
                'PLACE': '',
                'DATE': datetime.now().date().isoformat(),
                'TEMPLATE_NAME': 'basic'
            }

            java_url = f"{RESUME_BUILDER_API_URL}/api/resume"

            saved_info = None
            if HAVE_REQUESTS:
                r = requests.post(java_url, json=resume_payload, timeout=5)
                if r.ok:
                    saved_info = r.json()
            else:
                req = _urllib_request.Request(java_url, data=bytes(json.dumps(resume_payload), 'utf-8'), headers={'Content-Type': 'application/json'})
                try:
                    with _urllib_request.urlopen(req, timeout=5) as resp:
                        body = resp.read().decode('utf-8')
                        saved_info = json.loads(body)
                except _urllib_error.URLError:
                    saved_info = None

            if saved_info:
                response_data['saved_resume'] = saved_info
        except Exception as e:
            print(f"Warning: could not save resume to Java backend: {e}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        print(f"Error: {traceback.format_exc()}")
        return _json_error(f'Error processing resume: {str(e)}', 500)
    finally:
        _safe_rmtree(temp_dir)


@app.route('/api/score/text', methods=['POST'])
def score_text():
    """
    Score resume from plain text (no file upload)
    
    Request JSON:
        - resume_text: Resume content as text
        - job_description: (optional) Job description text
        - job_id: (optional) Job ID from dataset
    
    Response: Same as /api/score
    """
    
    try:
        if _is_rate_limited('score_text'):
            return _json_error('Rate limit exceeded. Please wait and try again.', 429)

        data = request.get_json(silent=True)
        
        if not data or 'resume_text' not in data:
            return _json_error('No resume text provided', 400)
        
        resume_text = data['resume_text']
        validation_error = _validate_resume_text(resume_text)
        if validation_error:
            return _json_error(validation_error, 400)
        
        # Get job description - either from job_id or manual input
        job_description, job_info, job_id = _resolve_job_context(
            data.get('job_id'),
            data.get('job_description', None),
        )
        
        # Score the resume
        result = scorer.score_resume(
            resume_text=resume_text,
            job_description=job_description
        )
        
        # Save to history
        analysis_record = {
            'id': len(analysis_history) + 1,
            'filename': 'text_input',
            'timestamp': datetime.now().isoformat(),
            'score': result.overall_score,
            'has_job_match': job_description is not None,
            'job_id': job_id if job_id else None
        }
        _append_analysis_history(analysis_record)
        
        response_data = {
            'success': True,
            'analysis_id': analysis_record['id'],
            'overall_score': result.overall_score,
            'category_scores': result.category_scores,
            'recommendations': result.recommendations,
            'job_match_score': result.job_match_score,
            'skills_gap': result.skills_gap,
            'language': result.language,
            'bert_semantic_score': result.bert_semantic_score,
            'version': result.version,
            'timestamp': analysis_record['timestamp'],
            'scoring_breakdown': result.scoring_breakdown
        }
        
        if job_info:
            response_data['job_info'] = job_info
        
        return jsonify(response_data), 200
        
    except Exception as e:
        import traceback
        print(f"Error: {traceback.format_exc()}")
        return _json_error(f'Error processing text: {str(e)}', 500)


@app.route('/api/batch', methods=['POST'])
def batch_score():
    """
    Score multiple resumes at once
    
    Request:
        - files[]: Multiple resume files
        - job_description: (optional) Single job description for all
        - job_id: (optional) Job ID from dataset for all
    
    Response:
        - results: Array of scoring results
    """
    
    try:
        if _is_rate_limited('batch'):
            return _json_error('Rate limit exceeded. Please wait and try again.', 429)

        files = request.files.getlist('files[]')
        
        if not files or len(files) == 0:
            return _json_error('No files provided', 400)
        
        if len(files) > 20:
            return _json_error('Maximum 20 files allowed', 400)
        
        job_description, job_info, _ = _resolve_job_context(
            request.form.get('job_id'),
            request.form.get('job_description', None),
        )
        
        results = []
        
        for file in files:
            temp_dir = None
            filepath = None
            filename = secure_filename(file.filename or '')
            if not filename:
                results.append({'filename': 'unknown', 'success': False, 'error': 'Empty filename'})
                continue
            if not allowed_file(filename):
                results.append({'filename': filename, 'success': False, 'error': 'Invalid file type'})
                continue
            try:
                temp_dir, filepath, filename = _save_uploaded_file(file)
                
                resume_text = scorer.extract_text(filepath)
                validation_error = _validate_resume_text(resume_text)
                if validation_error:
                    results.append({
                        'filename': filename,
                        'success': False,
                        'error': validation_error,
                    })
                    continue

                result = scorer.score_resume(
                    resume_text=resume_text,
                    job_description=job_description,
                    file_path=filepath
                )
                
                results.append({
                    'filename': filename,
                    'success': True,
                    'overall_score': result.overall_score,
                    'category_scores': result.category_scores,
                    'job_match_score': result.job_match_score,
                    'skills_gap': result.skills_gap,
                    'scoring_breakdown': result.scoring_breakdown
                })
            except Exception as e:
                results.append({
                    'filename': filename,
                    'success': False,
                    'error': str(e)
                })
            finally:
                _safe_rmtree(temp_dir)
        
        response = {
            'success': True,
            'total_processed': len(results),
            'results': results
        }
        
        if job_info:
            response['job_info'] = job_info
        
        return jsonify(response), 200
        
    except Exception as e:
        return _json_error(f'Batch processing error: {str(e)}', 500)


@app.route('/api/history', methods=['GET'])
def get_history():
    """
    Get analysis history
    
    Query params:
        - limit: Number of records to return (default: 50)
    """
    
    limit = request.args.get('limit', 50, type=int)
    limit = min(limit, 100)  # Max 100 records
    
    return jsonify({
        'success': True,
        'total': len(analysis_history),
        'history': analysis_history[-limit:][::-1]  # Most recent first
    }), 200


@app.route('/api/history/<int:analysis_id>', methods=['GET'])
def get_analysis(analysis_id: int):
    """Get specific analysis by ID"""
    
    analysis = next(
        (a for a in analysis_history if a['id'] == analysis_id), 
        None
    )
    
    if not analysis:
        return jsonify({'error': 'Analysis not found'}), 404
    
    return jsonify({
        'success': True,
        'analysis': analysis
    }), 200


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get aggregate statistics"""
    
    if not analysis_history:
        return jsonify({
            'success': True,
            'total_analyses': 0,
            'average_score': 0,
            'score_distribution': {}
        }), 200
    
    scores = [a['score'] for a in analysis_history]
    
    # Score distribution
    distribution = {
        'excellent': len([s for s in scores if s >= 80]),
        'good': len([s for s in scores if 60 <= s < 80]),
        'fair': len([s for s in scores if 40 <= s < 60]),
        'needs_improvement': len([s for s in scores if s < 40])
    }
    
    return jsonify({
        'success': True,
        'total_analyses': len(analysis_history),
        'average_score': sum(scores) / len(scores),
        'highest_score': max(scores),
        'lowest_score': min(scores),
        'score_distribution': distribution,
        'with_job_matching': len([a for a in analysis_history if a['has_job_match']])
    }), 200


@app.route('/api/compare', methods=['POST'])
def compare_resumes():
    """
    Compare two resumes side-by-side
    
    Request:
        - file1: First resume
        - file2: Second resume
        - job_description: (optional) Job description
        - job_id: (optional) Job ID from dataset
    """
    
    temp_dirs_to_cleanup = []
    try:
        if _is_rate_limited('compare'):
            return _json_error('Rate limit exceeded. Please wait and try again.', 429)

        if 'file1' not in request.files or 'file2' not in request.files:
            return _json_error('Two files required', 400)
        
        file1 = request.files['file1']
        file2 = request.files['file2']
        job_description, _, _ = _resolve_job_context(
            request.form.get('job_id'),
            request.form.get('job_description', None),
        )
        
        results = []
        
        for file in [file1, file2]:
            if not allowed_file(file.filename):
                return _json_error(f'Invalid file type: {file.filename}', 400)
            
            temp_dir, filepath, filename = _save_uploaded_file(file)
            temp_dirs_to_cleanup.append(temp_dir)
            
            resume_text = scorer.extract_text(filepath)
            validation_error = _validate_resume_text(resume_text)
            if validation_error:
                return _json_error(
                    f'Could not extract sufficient text from {filename}',
                    400,
                    {'validation_error': validation_error},
                )
            result = scorer.score_resume(
                resume_text=resume_text,
                job_description=job_description,
                file_path=filepath
            )
            
            results.append({
                'filename': filename,
                'overall_score': result.overall_score,
                'category_scores': result.category_scores,
                'job_match_score': result.job_match_score,
                'recommendations': result.recommendations,
                'scoring_breakdown': result.scoring_breakdown
            })

        # Calculate comparison insights
        score_diff = results[0]['overall_score'] - results[1]['overall_score']
        winner = 0 if score_diff > 0 else 1
        
        return jsonify({
            'success': True,
            'resume1': results[0],
            'resume2': results[1],
            'comparison': {
                'score_difference': abs(score_diff),
                'higher_scoring': results[winner]['filename'],
                'winner_index': winner
            }
        }), 200
        
    except Exception as e:
        import traceback
        print(f"Error: {traceback.format_exc()}")
        return _json_error(f'Comparison error: {str(e)}', 500)
    finally:
        for temp_dir in temp_dirs_to_cleanup:
            _safe_rmtree(temp_dir)


@app.route('/api/keywords', methods=['GET'])
def get_keywords():
    """Get list of tracked keywords by category"""
    return jsonify({
        'success': True,
        'keywords': getattr(scorer, 'keywords', {}),
        'skill_synonyms': getattr(scorer, 'skill_aliases', {})
    }), 200


@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    return _json_error('File too large. Maximum size is 16MB.', 413)


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return _json_error('Endpoint not found', 404)


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return _json_error('Internal server error', 500)


if __name__ == '__main__':
    print("\n" + "="*60)
    print("ATS Resume Scorer V4.0 - WITH JOB DATASET - API Server")
    print("="*60)
    print(f"Server starting on {ATS_API_URL}")
    
    if jobs_df is not None:
        print(f"\nJob Dataset Loaded:")
        print(f"   Total Jobs: {len(jobs_df)}")
        print(f"   Categories: {jobs_df['Category'].nunique()}")
        print(f"   Experience Levels: {jobs_df['Experience Level'].nunique()}")
    else:
        print("\nJob Dataset NOT loaded - check Peak_Accuracy_ATS_Dataset.xlsx")
    
    print("\nNew Endpoints:")
    print("   GET  /api/jobs - Get list of jobs with filters")
    print("   GET  /api/jobs/<id> - Get specific job")
    print("   GET  /api/jobs/filters - Get filter options")
    print("   POST /api/score - Now accepts job_id parameter")
    print("="*60 + "\n")
    
    app.run(host=ATS_BIND_HOST, port=ATS_BIND_PORT, debug=True)


