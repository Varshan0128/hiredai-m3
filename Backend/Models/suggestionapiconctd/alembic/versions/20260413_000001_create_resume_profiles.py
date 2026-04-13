"""create resume_profiles table

Revision ID: 20260413_000001
Revises:
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa


revision = "20260413_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("resume_file_url", sa.Text(), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("file_type", sa.String(length=20), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("inferred_roles", sa.JSON(), nullable=False),
        sa.Column("experience_level", sa.String(length=32), nullable=True),
        sa.Column("years_of_experience", sa.Float(), nullable=True),
        sa.Column("education", sa.JSON(), nullable=False),
        sa.Column("certifications", sa.JSON(), nullable=False),
        sa.Column("projects", sa.JSON(), nullable=False),
        sa.Column("languages", sa.JSON(), nullable=False),
        sa.Column("resume_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_resume_profiles_user_id"),
    )
    op.create_index(op.f("ix_resume_profiles_user_id"), "resume_profiles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_resume_profiles_user_id"), table_name="resume_profiles")
    op.drop_table("resume_profiles")
