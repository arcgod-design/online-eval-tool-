"""
NeuroLab Seed Script

Creates demo lab, users, compounds, templates, and protocols.
Run with: python -m scripts.seed
"""

import sys
import os
from datetime import datetime, timedelta
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'api'))

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User
from app.models.lab import Lab, LabMember
from app.models.project import Project, ProjectMember
from app.models.compound import Compound, CompoundMechanism
from app.models.protocol import Protocol, ProtocolStep, ProtocolStepCompound
from app.models.experiment import Experiment
from app.models.subject import Subject, SubjectTemplate, SubjectVersion
from app.models.run import Run, StateSnapshot, DoseEvent
from app.models.report import Report, Export, AuditLog

# Create tables
from app.core.database import Base
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # Create demo users
    users_data = [
        {"email": "demo@neurolab.io", "name": "Demo Researcher", "role": "owner"},
        {"email": "admin@neurolab.io", "name": "Lab Admin", "role": "admin"},
        {"email": "researcher1@neurolab.io", "name": "Dr. Smith", "role": "researcher"},
        {"email": "researcher2@neurolab.io", "name": "Dr. Jones", "role": "researcher"},
        {"email": "viewer@neurolab.io", "name": "Research Viewer", "role": "viewer"},
    ]
    
    created_users = {}
    for u in users_data:
        user = db.query(User).filter(User.email == u["email"]).first()
        if not user:
            user = User(
                email=u["email"],
                display_name=u["name"],
                hashed_password=get_password_hash("demo123"),
                account_status="active",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created user: {user.email}")
        created_users[u["role"]] = user

    # Create demo lab
    demo_lab = db.query(Lab).filter(Lab.slug == "demo-lab").first()
    if not demo_lab:
        demo_lab = Lab(
            name="Demo Lab",
            slug="demo-lab",
            description="A demonstration lab for NeuroLab brain-study experiments",
            visibility="private",
            retention_days=90,
            created_by=created_users["owner"].id,
            updated_by=created_users["owner"].id,
        )
        db.add(demo_lab)
        db.commit()
        db.refresh(demo_lab)
        
        # Add all users to lab with different roles
        for role, user in created_users.items():
            member = LabMember(
                lab_id=demo_lab.id,
                user_id=user.id,
                role=role,
                created_by=created_users["owner"].id,
                updated_by=created_users["owner"].id,
            )
            db.add(member)
        db.commit()
        print(f"Created demo lab: {demo_lab.name}")

    # Create demo projects
    projects_data = [
        {"name": "Compound Effects Study", "slug": "compound-effects-study"},
        {"name": "Caffeine vs Sleep", "slug": "caffeine-vs-sleep"},
        {"name": "Nootropic Comparison", "slug": "nootropic-comparison"},
    ]
    
    created_projects = []
    for pdata in projects_data:
        project = db.query(Project).filter(Project.slug == pdata["slug"]).first()
        if not project:
            project = Project(
                lab_id=demo_lab.id,
                name=pdata["name"],
                slug=pdata["slug"],
                description=f"Demo project: {pdata['name']}",
                visibility="private",
                created_by=created_users["owner"].id,
                updated_by=created_users["owner"].id,
            )
            db.add(project)
            db.commit()
            db.refresh(project)
            
            pm = ProjectMember(
                project_id=project.id,
                user_id=created_users["owner"].id,
                role="owner",
            )
            db.add(pm)
            db.commit()
            print(f"Created project: {project.name}")
        created_projects.append(project)

    # Seed subject templates (8 required)
    templates = [
        {
            "name": "calm_baseline",
            "display_name": "Calm Baseline",
            "description": "A calm, stable baseline subject",
            "template_data": {
                "baseline_stress": 20.0, "baseline_anxiety": 15.0, "baseline_mood": 70.0,
                "baseline_focus": 65.0, "trait_neuroticism": 30.0, "stimulant_sensitivity": 50.0,
            }
        },
        {
            "name": "anxious",
            "display_name": "Anxious Subject",
            "description": "Subject with higher baseline anxiety",
            "template_data": {
                "baseline_stress": 55.0, "baseline_anxiety": 60.0, "baseline_mood": 50.0,
                "trait_neuroticism": 70.0, "anxiety_prone_score": 65.0,
            }
        },
        {
            "name": "adhd_like",
            "display_name": "ADHD-like Profile",
            "description": "Subject with attention-related challenges",
            "template_data": {
                "baseline_focus": 35.0, "baseline_impulsivity": 65.0, "adhd_like_score": 70.0,
                "trait_conscientiousness": 35.0, "reward_sensitivity": 70.0,
            }
        },
        {
            "name": "sleep_deprived",
            "display_name": "Sleep Deprived",
            "description": "Subject with poor sleep baseline",
            "template_data": {
                "baseline_sleep_hours": 4.0, "baseline_energy": 30.0,
                "baseline_mood": 45.0, "fatigue_sensitivity": 70.0,
            }
        },
        {
            "name": "high_focus",
            "display_name": "High Focus",
            "description": "Subject with naturally high focus capacity",
            "template_data": {
                "baseline_focus": 80.0, "baseline_memory": 75.0,
                "trait_conscientiousness": 75.0, "adhd_like_score": 10.0,
            }
        },
        {
            "name": "depression_prone",
            "display_name": "Depression Prone",
            "description": "Subject with higher depression vulnerability",
            "template_data": {
                "baseline_mood": 40.0, "baseline_energy": 40.0, "depression_prone_score": 65.0,
                "trait_neuroticism": 65.0, "baseline_anxiety": 45.0,
            }
        },
        {
            "name": "impulsive_high_reward",
            "display_name": "Impulsive High Reward",
            "description": "Subject with high reward sensitivity and impulsivity",
            "template_data": {
                "baseline_impulsivity": 75.0, "reward_sensitivity": 80.0,
                "baseline_focus": 45.0, "trait_conscientiousness": 30.0,
            }
        },
        {
            "name": "stress_resilient",
            "display_name": "Stress Resilient",
            "description": "Subject with high stress tolerance",
            "template_data": {
                "baseline_stress": 25.0, "stress_reactivity": 25.0, "baseline_anxiety": 20.0,
                "trait_neuroticism": 25.0, "baseline_mood": 65.0,
            }
        },
    ]
    
    for tmpl_data in templates:
        existing = db.query(SubjectTemplate).filter(SubjectTemplate.name == tmpl_data["name"]).first()
        if not existing:
            template = SubjectTemplate(
                name=tmpl_data["name"],
                display_name=tmpl_data["display_name"],
                description=tmpl_data["description"],
                scope="global",
                template_data=tmpl_data["template_data"],
            )
            db.add(template)
    db.commit()
    print(f"Created {len(templates)} subject templates")

    # Seed compounds (20 minimum required)
    compounds = [
        {"name": "Caffeine", "category": "stimulants", "onset": 30, "peak": 60, "half_life": 360, "neuroscience": True},
        {"name": "L-Theanine", "category": "supplements", "onset": 30, "peak": 60, "half_life": 60, "neuroscience": True},
        {"name": "GABA", "category": "supplements", "onset": 20, "peak": 45, "half_life": 60, "neuroscience": True},
        {"name": "Nicotine", "category": "stimulants", "onset": 5, "peak": 20, "half_life": 120, "neuroscience": True},
        {"name": "Melatonin", "category": "supplements", "onset": 30, "peak": 60, "half_life": 45, "neuroscience": True},
        {"name": "Modafinil", "category": "stimulants", "onset": 60, "peak": 180, "half_life": 720, "neuroscience": True},
        {"name": "Alcohol", "category": "sedatives_anxiolytics", "onset": 15, "peak": 60, "half_life": 180, "neuroscience": True},
        {"name": "Magnesium", "category": "supplements", "onset": 60, "peak": 120, "half_life": 360, "neuroscience": True},
        {"name": "Omega-3", "category": "supplements", "onset": 120, "peak": 360, "half_life": 1440, "neuroscience": True},
        {"name": "Creatine", "category": "supplements", "onset": 60, "peak": 120, "half_life": 360, "neuroscience": True},
        {"name": "B-Vitamin Complex", "category": "supplements", "onset": 60, "peak": 180, "half_life": 720, "neuroscience": True},
        {"name": "SSRI Generic", "category": "antidepressants", "onset": 240, "peak": 360, "half_life": 1440, "neuroscience": True},
        {"name": "Benzodiazepine Generic", "category": "sedatives_anxiolytics", "onset": 30, "peak": 90, "half_life": 300, "neuroscience": True},
        {"name": "Cannabis Generic", "category": "psychedelics", "onset": 10, "peak": 60, "half_life": 180, "neuroscience": True},
        {"name": "Amphetamine Generic", "category": "stimulants", "onset": 30, "peak": 120, "half_life": 480, "neuroscience": True},
        {"name": "Psilocybin Generic", "category": "psychedelics", "onset": 45, "peak": 120, "half_life": 240, "neuroscience": True},
        {"name": "Exercise Session", "category": "lifestyle_interventions", "onset": 5, "peak": 30, "half_life": 240, "neuroscience": True},
        {"name": "Sleep Deprivation", "category": "lifestyle_interventions", "onset": 0, "peak": 720, "half_life": 1440, "neuroscience": True},
        {"name": "Acute Stress", "category": "lifestyle_interventions", "onset": 1, "peak": 30, "half_life": 120, "neuroscience": True},
        {"name": "Mindfulness Session", "category": "lifestyle_interventions", "onset": 10, "peak": 60, "half_life": 180, "neuroscience": True},
    ]
    
    created_compounds = []
    for c in compounds:
        slug = c["name"].lower().replace(" ", "_").replace("-", "_")
        existing = db.query(Compound).filter(Compound.slug == slug).first()
        if not existing:
            compound = Compound(
                scope_type="global",
                slug=slug,
                display_name=c["name"],
                category=c["category"],
                is_neuroscience_core=c["neuroscience"],
                mechanism_coverage="core" if c["neuroscience"] else "partial",
                onset_minutes=c["onset"],
                peak_minutes=c["peak"],
                half_life_minutes=c["half_life"],
                decay_model="exponential",
                active=True,
            )
            db.add(compound)
            db.flush()
            created_compounds.append(compound)
        else:
            created_compounds.append(existing)
    db.commit()
    print(f"Created {len(compounds)} compounds")

    # Seed 5 protocols
    main_project = created_projects[0]
    protocols_data = [
        {
            "name": "Caffeine Focus Study",
            "description": "1-hour caffeine protocol to study focus effects",
            "time_resolution": "minute",
            "duration_value": 60,
            "duration_unit": "minute",
        },
        {
            "name": "Sleep Deprivation Recovery",
            "description": "Track recovery from 24-hour sleep deprivation",
            "time_resolution": "hour",
            "duration_value": 48,
            "duration_unit": "hour",
        },
        {
            "name": "Combined Nootropic Test",
            "description": "Test caffeine + L-theanine combination",
            "time_resolution": "minute",
            "duration_value": 120,
            "duration_unit": "minute",
        },
        {
            "name": "Acute Stress Response",
            "description": "Measure stress response and recovery",
            "time_resolution": "minute",
            "duration_value": 90,
            "duration_unit": "minute",
        },
        {
            "name": "Weekly Wellness Tracking",
            "description": "Multi-day wellness monitoring protocol",
            "time_resolution": "day",
            "duration_value": 7,
            "duration_unit": "day",
        },
    ]
    
    created_protocols = []
    for pdata in protocols_data:
        existing = db.query(Protocol).filter(
            Protocol.project_id == main_project.id,
            Protocol.name == pdata["name"]
        ).first()
        if not existing:
            protocol = Protocol(
                project_id=main_project.id,
                name=pdata["name"],
                description=pdata["description"],
                time_resolution=pdata["time_resolution"],
                duration_value=pdata["duration_value"],
                duration_unit=pdata["duration_unit"],
                allow_manual_interventions=True,
                created_by=created_users["owner"].id,
                updated_by=created_users["owner"].id,
            )
            db.add(protocol)
            db.flush()
            
            # Add basic steps
            step = ProtocolStep(
                protocol_id=protocol.id,
                order_index=0,
                label="Baseline measurement",
                start_offset_minutes=0,
                end_offset_minutes=10,
                event_type="measurement",
                config_json={},
            )
            db.add(step)
            created_protocols.append(protocol)
        else:
            created_protocols.append(existing)
    db.commit()
    print(f"Created {len(protocols_data)} protocols")

    # Create 3 example experiments
    experiments_data = [
        {"name": "Caffeine 100mg vs 200mg", "protocol_idx": 0},
        {"name": "Sleep Recovery Baseline", "protocol_idx": 1},
        {"name": "Nootropic Stack Test", "protocol_idx": 2},
    ]
    
    created_experiments = []
    if created_protocols:
        for edata in experiments_data:
            existing = db.query(Experiment).filter(
                Experiment.project_id == main_project.id,
                Experiment.name == edata["name"]
            ).first()
            if not existing:
                exp = Experiment(
                    project_id=main_project.id,
                    name=edata["name"],
                    description=f"Demo experiment: {edata['name']}",
                    kind="compound_study",
                    protocol_id=created_protocols[edata["protocol_idx"]].id if edata["protocol_idx"] < len(created_protocols) else created_protocols[0].id,
                    subject_ids=[],
                    config={},
                    status="draft",
                    created_by=created_users["owner"].id,
                    updated_by=created_users["owner"].id,
                )
                db.add(exp)
                db.flush()
                created_experiments.append(exp)
            else:
                created_experiments.append(existing)
        db.commit()
        print(f"Created {len(experiments_data)} experiments")

    # Create subjects for each project
    subjects_data = [
        {
            "name": "Alpha Subject",
            "slug": "alpha-subject",
            "description": "Calm baseline subject for caffeine studies",
            "project_id": created_projects[0].id,
            "baseline_stress": 20.0,
            "baseline_anxiety": 15.0,
            "baseline_mood": 70.0,
            "baseline_focus": 65.0,
            "stimulant_sensitivity": 50.0,
        },
        {
            "name": "Beta Subject",
            "slug": "beta-subject",
            "description": "Anxious prone subject for sleep studies",
            "project_id": created_projects[1].id,
            "baseline_stress": 55.0,
            "baseline_anxiety": 60.0,
            "baseline_mood": 50.0,
            "baseline_focus": 45.0,
            "stimulant_sensitivity": 65.0,
        },
        {
            "name": "Gamma Subject",
            "slug": "gamma-subject",
            "description": "High focus subject for nootropic studies",
            "project_id": created_projects[2].id,
            "baseline_stress": 30.0,
            "baseline_anxiety": 25.0,
            "baseline_mood": 65.0,
            "baseline_focus": 80.0,
            "stimulant_sensitivity": 40.0,
        },
    ]
    
    created_subjects = []
    for sdata in subjects_data:
        existing = db.query(Subject).filter(
            Subject.project_id == sdata["project_id"],
            Subject.slug == sdata["slug"]
        ).first()
        if not existing:
            subject = Subject(
                project_id=sdata["project_id"],
                name=sdata["name"],
                slug=sdata["slug"],
                description=sdata["description"],
                age_range="25-35",
                biological_sex="mixed",
                baseline_sleep_hours=7.5,
                baseline_stress=sdata["baseline_stress"],
                baseline_anxiety=sdata["baseline_anxiety"],
                baseline_mood=sdata["baseline_mood"],
                baseline_focus=sdata["baseline_focus"],
                baseline_memory=70.0,
                baseline_energy=60.0,
                baseline_impulsivity=40.0,
                baseline_sensitivity=50.0,
                trait_openness=50.0,
                trait_conscientiousness=50.0,
                trait_extraversion=50.0,
                trait_agreeableness=50.0,
                trait_neuroticism=50.0,
                adhd_like_score=30.0,
                anxiety_prone_score=30.0,
                depression_prone_score=25.0,
                stress_reactivity=50.0,
                reward_sensitivity=50.0,
                fatigue_sensitivity=50.0,
                stimulant_sensitivity=sdata["stimulant_sensitivity"],
                sedative_sensitivity=50.0,
                dependency_vulnerability=30.0,
                withdrawal_vulnerability=30.0,
                expression_style="human_default",
                diary_style="human_default",
                tags=["demo", "seed"],
                created_by=created_users["owner"].id,
                updated_by=created_users["owner"].id,
            )
            db.add(subject)
            db.flush()
            created_subjects.append(subject)
            print(f"Created subject: {subject.name}")
        else:
            created_subjects.append(existing)
    db.commit()

    # Create 6 example completed runs
    from datetime import timedelta
    runs_data = [
        {
            "name": "Caffeine 100mg Run 1",
            "experiment_idx": 0,
            "subject_idx": 0,
            "time_resolution": "minute",
            "duration_minutes": 60,
            "status": "completed",
            "seed": 12345,
        },
        {
            "name": "Caffeine 200mg Run 1",
            "experiment_idx": 0,
            "subject_idx": 0,
            "time_resolution": "minute",
            "duration_minutes": 60,
            "status": "completed",
            "seed": 12346,
        },
        {
            "name": "Sleep Recovery Day 1",
            "experiment_idx": 1,
            "subject_idx": 1,
            "time_resolution": "hour",
            "duration_minutes": 2880,  # 48 hours
            "status": "completed",
            "seed": 22345,
        },
        {
            "name": "Sleep Recovery Day 2",
            "experiment_idx": 1,
            "subject_idx": 1,
            "time_resolution": "hour",
            "duration_minutes": 2880,
            "status": "completed",
            "seed": 22346,
        },
        {
            "name": "Nootropic Stack Run 1",
            "experiment_idx": 2,
            "subject_idx": 2,
            "time_resolution": "minute",
            "duration_minutes": 120,
            "status": "completed",
            "seed": 32345,
        },
        {
            "name": "Nootropic Stack Run 2",
            "experiment_idx": 2,
            "subject_idx": 2,
            "time_resolution": "minute",
            "duration_minutes": 120,
            "status": "completed",
            "seed": 32346,
        },
    ]
    
    created_runs = []
    for rdata in runs_data:
        # Check if run already exists (by seed)
        existing = db.query(Run).filter(Run.seed == rdata["seed"]).first()
        if not existing:
            base_time = datetime.utcnow() - timedelta(days=7)  # 7 days ago
            started_at = base_time
            ended_at = base_time + timedelta(minutes=rdata["duration_minutes"])
            
            run = Run(
                experiment_id=created_experiments[rdata["experiment_idx"]].id,
                project_id=created_projects[0].id,  # All runs in main project
                status=rdata["status"],
                seed=rdata["seed"],
                retention_days=90,
                started_at=started_at,
                ended_at=ended_at,
                time_resolution=rdata["time_resolution"],
                controller_user_id=created_users["owner"].id,
                meta={"name": rdata["name"], "seed": rdata["seed"]},
                created_by=created_users["owner"].id,
                updated_by=created_users["owner"].id,
            )
            db.add(run)
            db.flush()
            created_runs.append(run)
            
            # Create some state snapshots for the run
            num_snapshots = 10 if rdata["time_resolution"] == "minute" else 5
            for i in range(num_snapshots):
                sim_time = (rdata["duration_minutes"] / num_snapshots) * i
                
                # Create realistic state snapshot
                snapshot = StateSnapshot(
                    run_id=run.id,
                    tick_index=i,
                    sim_time_minutes=sim_time,
                    neurotransmitters={
                        "dopamine": 50.0 + (i * 2.0),
                        "serotonin": 60.0 + (i * 1.5),
                        "norepinephrine": 40.0 + (i * 1.0),
                        "gaba": 45.0 - (i * 0.5),
                    },
                    regions={
                        "prefrontal_cortex": 70.0 + (i * 1.0),
                        "amygdala": 30.0 - (i * 0.5),
                        "hippocampus": 65.0 + (i * 0.8),
                        "thalamus": 60.0,
                    },
                    functions={
                        "focus": 65.0 + (i * 1.2),
                        "mood": 70.0 + (i * 0.8),
                        "anxiety": 25.0 - (i * 0.6),
                        "memory": 70.0 + (i * 0.4),
                    },
                    behaviors={
                        "alertness": 60.0 + (i * 1.5),
                        "calmness": 65.0 - (i * 0.3),
                        "energy": 55.0 + (i * 2.0),
                        "social_engagement": 50.0 + (i * 0.7),
                    },
                    active_compounds=[
                        {
                            "compound_id": str(created_compounds[0].id),  # Caffeine
                            "dose_mg": 100.0,
                            "concentration": 0.8 - (i * 0.05),
                        }
                    ],
                    state_json={
                        "overall_wellbeing": 70.0 + (i * 0.8),
                        "cognitive_load": 40.0 + (i * 1.0),
                        "stress_level": 30.0 - (i * 0.5),
                    },
                )
                db.add(snapshot)
            
            print(f"Created run: {rdata['name']} with {num_snapshots} snapshots")
        else:
            created_runs.append(existing)
    db.commit()

    # Create 2 example reports
    reports_data = [
        {
            "title": "Caffeine Dose-Response Analysis",
            "description": "Comparative analysis of 100mg vs 200mg caffeine effects on cognitive performance",
            "run_idx": 0,
            "report_type": "comparison",
            "status": "published",
            "visibility": "public",
        },
        {
            "title": "Sleep Recovery Progress Report",
            "description": "Detailed analysis of recovery patterns following 24-hour sleep deprivation",
            "run_idx": 2,
            "report_type": "full",
            "status": "published",
            "visibility": "private",
        },
    ]
    
    created_reports = []
    for rdata in reports_data:
        existing = db.query(Report).filter(Report.title == rdata["title"]).first()
        if not existing:
            report = Report(
                run_id=created_runs[rdata["run_idx"]].id,
                project_id=created_projects[0].id,
                title=rdata["title"],
                description=rdata["description"],
                report_type=rdata["report_type"],
                status=rdata["status"],
                visibility=rdata["visibility"],
                content_json={
                    "summary": f"Demo report: {rdata['title']}",
                    "findings": [
                        "Significant improvement in focus metrics",
                        "Mood stability observed throughout run",
                        "Anxiety levels remained within normal range",
                    ],
                    "recommendations": [
                        "Continue monitoring with similar protocols",
                        "Consider extending duration for long-term effects",
                        "Document any adverse reactions",
                    ],
                    "statistics": {
                        "average_focus": 72.5,
                        "average_mood": 68.2,
                        "average_anxiety": 22.1,
                        "peak_focus": 85.3,
                        "lowest_anxiety": 15.8,
                    },
                },
                published_at=datetime.utcnow(),
                published_by=created_users["owner"].id,
                model_version="1.0",
                protocol_version=1,
                compound_registry_version=1,
                created_by=created_users["owner"].id,
                updated_by=created_users["owner"].id,
            )
            db.add(report)
            db.flush()
            created_reports.append(report)
            print(f"Created report: {report.title}")
        else:
            created_reports.append(existing)
    db.commit()

    print("\n" + "="*50)
    print("SEED COMPLETE!")
    print("="*50)
    print(f"\nDemo credentials:")
    print(f"  Email: demo@neurolab.io")
    print(f"  Password: demo123")
    print(f"\nCreated:")
    print(f"  - {len(users_data)} users")
    print(f"  - 1 lab")
    print(f"  - {len(projects_data)} projects")
    print(f"  - {len(templates)} subject templates")
    print(f"  - {len(compounds)} compounds")
    print(f"  - {len(protocols_data)} protocols")
    print(f"  - {len(experiments_data)} experiments")
    print(f"  - {len(subjects_data)} subjects")
    print(f"  - {len(runs_data)} completed runs")
    print(f"  - {len(reports_data)} reports")

finally:
    db.close()
